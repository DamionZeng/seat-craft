import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import type { Gender, Student } from '../types';
import { localTraitsFromRaw, splitTraitText } from './semantics';
import { uid } from './utils';

export interface ParsedTable {
  rows: string[][];
  fileName: string;
  hasHeader: boolean;
}

export type ImportField = 'studentNo' | 'name' | 'gender' | 'height' | 'traits' | 'note';

export type ColumnMapping = Partial<Record<ImportField, number>>;

export interface ImportIssue {
  row: number;
  message: string;
}

const FIELD_KEYWORDS: Record<ImportField, string[]> = {
  studentNo: ['学号', '学生学号', '学籍号', '编号', '序号', 'id', 'no'],
  name: ['姓名', '学生姓名', '名字', 'name'],
  gender: ['性别', 'gender', 'sex'],
  height: ['身高', '身高(cm)', '身高cm', 'height'],
  traits: ['特点', '特征', '标签', '性格', 'traits', 'tags'],
  note: ['备注', '说明', 'note', 'remark'],
};

const FIELD_ORDER: ImportField[] = ['studentNo', 'name', 'gender', 'height', 'traits', 'note'];

function normalizeHeader(cell: string) {
  return cell.replace(/[\s()（）:：]/g, '').toLowerCase();
}

export function detectMapping(rows: string[][]): { mapping: ColumnMapping; hasHeader: boolean } {
  if (!rows.length) return { mapping: {}, hasHeader: false };
  const header = rows[0].map((c) => normalizeHeader(String(c ?? '')));
  const mapping: ColumnMapping = {};
  header.forEach((cell, index) => {
    for (const field of FIELD_ORDER) {
      if (mapping[field] !== undefined) continue;
      if (FIELD_KEYWORDS[field].some((kw) => cell === normalizeHeader(kw))) {
        mapping[field] = index;
        break;
      }
    }
  });
  const matched = Object.keys(mapping).length;
  if (matched >= 2) return { mapping, hasHeader: true };

  // 无表头：按常见列顺序猜测
  const guess: ColumnMapping = {};
  FIELD_ORDER.forEach((field, i) => {
    if (i < rows[0].length) guess[field] = i;
  });
  return { mapping: guess, hasHeader: false };
}

function decodeBuffer(buffer: ArrayBuffer): string {
  try {
    const utf8 = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    return utf8;
  } catch {
    try {
      return new TextDecoder('gbk').decode(buffer);
    } catch {
      return new TextDecoder('utf-8').decode(buffer);
    }
  }
}

export async function parseFile(file: File): Promise<ParsedTable> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv') || name.endsWith('.txt')) {
    const buffer = await file.arrayBuffer();
    const text = decodeBuffer(buffer);
    const result = Papa.parse<string[]>(text, { skipEmptyLines: 'greedy' });
    const rows = (result.data as any[]).map((row) =>
      (Array.isArray(row) ? row : [row]).map((cell) => String(cell ?? '').trim()),
    );
    const { hasHeader } = detectMapping(rows);
    return { rows, fileName: file.name, hasHeader };
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json<any[]>(sheet, {
    header: 1,
    raw: false,
    defval: '',
    blankrows: false,
  });
  const rows = json.map((row) => row.map((cell) => String(cell ?? '').trim()));
  const { hasHeader } = detectMapping(rows);
  return { rows, fileName: file.name, hasHeader };
}

export function parsePaste(text: string): ParsedTable {
  const trimmed = text.replace(/\r/g, '').trim();
  let rows: string[][];
  if (trimmed.includes('\t')) {
    rows = trimmed.split('\n').map((line) => line.split('\t').map((c) => c.trim()));
  } else {
    const result = Papa.parse<string[]>(trimmed, { skipEmptyLines: 'greedy' });
    rows = (result.data as any[]).map((row) =>
      (Array.isArray(row) ? row : [row]).map((cell) => String(cell ?? '').trim()),
    );
  }
  const { hasHeader } = detectMapping(rows);
  return { rows, fileName: '从剪贴板粘贴', hasHeader };
}

function normalizeGender(value: string): Gender {
  const v = value.trim().toLowerCase();
  if (!v) return 'unknown';
  if (['男', 'male', 'm', '1', 'boy'].includes(v)) return 'male';
  if (['女', 'female', 'f', '2', 'girl'].includes(v)) return 'female';
  if (v.includes('男')) return 'male';
  if (v.includes('女')) return 'female';
  return 'unknown';
}

function parseHeight(value: string): number | undefined {
  const match = /-?\d+(\.\d+)?/.exec(value.replace(/[,，]/g, ''));
  if (!match) return undefined;
  const n = Number(match[0]);
  if (!Number.isFinite(n)) return undefined;
  return Math.round(n * 10) / 10;
}

export interface BuildResult {
  students: Student[];
  issues: ImportIssue[];
  skipped: number;
}

export function buildStudents(
  table: ParsedTable,
  mapping: ColumnMapping,
  existingStudentNos: string[] = [],
): BuildResult {
  const start = table.hasHeader ? 1 : 0;
  const students: Student[] = [];
  const issues: ImportIssue[] = [];
  const seenNos = new Set(existingStudentNos);
  let skipped = 0;

  for (let i = start; i < table.rows.length; i++) {
    const row = table.rows[i] ?? [];
    const get = (field: ImportField) => {
      const index = mapping[field];
      return index === undefined ? '' : String(row[index] ?? '').trim();
    };
    if (row.every((cell) => !String(cell).trim())) {
      skipped++;
      continue;
    }
    const name = get('name');
    if (!name) {
      issues.push({ row: i + 1, message: '姓名为空，已跳过该行' });
      skipped++;
      continue;
    }
    let studentNo = get('studentNo');
    if (!studentNo) studentNo = `AUTO-${String(i + 1).padStart(3, '0')}`;
    if (seenNos.has(studentNo)) {
      issues.push({ row: i + 1, message: `学号 ${studentNo} 重复，已跳过` });
      skipped++;
      continue;
    }
    const heightValue = parseHeight(get('height'));
    if (heightValue !== undefined && (heightValue < 100 || heightValue > 230)) {
      issues.push({ row: i + 1, message: `身高 ${heightValue}cm 超出 100–230 范围，已忽略身高` });
    }
    const height =
      heightValue !== undefined && heightValue >= 100 && heightValue <= 230
        ? heightValue
        : undefined;

    const traitText = get('traits');
    const traits = splitTraitText(traitText).flatMap((raw) => localTraitsFromRaw(raw));

    seenNos.add(studentNo);
    students.push({
      id: uid('stu'),
      studentNo,
      name,
      gender: normalizeGender(get('gender')),
      height,
      traits,
      note: get('note'),
    });
  }

  return { students, issues, skipped };
}

export function downloadTemplate() {
  const data = [
    ['学号', '姓名', '性别', '身高', '特点', '备注'],
    ['2026001', '张三', '男', 172, '数学拔尖，但坐不住', '示例行，可删除'],
    ['2026002', '李四', '女', 160, '近视，需要前排；文静内向', ''],
    ['2026003', '王五', '男', 185, '话多，和谁都能聊', '高个优先后排'],
  ];
  const sheet = XLSX.utils.aoa_to_sheet(data);
  sheet['!cols'] = [
    { wch: 12 },
    { wch: 12 },
    { wch: 8 },
    { wch: 8 },
    { wch: 36 },
    { wch: 20 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, '学生名单');
  XLSX.writeFile(workbook, '学生名单导入模板.xlsx');
}
