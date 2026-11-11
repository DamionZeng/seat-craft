import { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ClipboardPaste,
  Download,
  FileSpreadsheet,
  RefreshCw,
  UploadCloud,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import {
  buildStudents,
  detectMapping,
  downloadTemplate,
  parseFile,
  parsePaste,
  type ColumnMapping,
  type ImportField,
  type ParsedTable,
} from '../lib/import';
import { Modal, Segmented } from './ui';
import clsx from 'clsx';

const FIELDS: { key: ImportField; label: string; required?: boolean }[] = [
  { key: 'studentNo', label: '学号' },
  { key: 'name', label: '姓名', required: true },
  { key: 'gender', label: '性别' },
  { key: 'height', label: '身高' },
  { key: 'traits', label: '特点' },
  { key: 'note', label: '备注' },
];

const FIELD_BADGE: Record<ImportField, string> = {
  studentNo: 'bg-primary-soft text-[#3446c9]',
  name: 'bg-ok-soft text-[#2c8463]',
  gender: 'bg-[#eef4ff] text-[#3c6fd1]',
  height: 'bg-warm-soft text-[#a9761f]',
  traits: 'bg-[#f4efff] text-[#7250c9]',
  note: 'bg-[#f1efe8] text-muted-foreground',
};

export function ImportDialog() {
  const open = useAppStore((s) => s.importOpen);
  const setOpen = useAppStore((s) => s.setImportOpen);
  const importStudents = useAppStore((s) => s.importStudents);
  const students = useAppStore((s) => s.students);
  const notify = useAppStore((s) => s.notify);

  const [table, setTable] = useState<ParsedTable | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [mode, setMode] = useState<'replace' | 'append'>('replace');
  const [tab, setTab] = useState<'file' | 'paste'>('file');
  const [dragging, setDragging] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setTable(null);
    setMapping({});
    setPasteText('');
    setError(null);
  };

  const existingNos = useMemo(
    () => (mode === 'append' ? students.map((s) => s.studentNo) : []),
    [mode, students],
  );

  const result = useMemo(() => {
    if (!table) return null;
    return buildStudents(table, mapping, existingNos);
  }, [table, mapping, existingNos]);

  const handleFile = async (file: File) => {
    setError(null);
    setBusy(true);
    try {
      const parsed = await parseFile(file);
      if (!parsed.rows.length) {
        setError('文件里没有读取到数据，请检查内容');
        setBusy(false);
        return;
      }
      setTable(parsed);
      setMapping(detectMapping(parsed.rows).mapping);
    } catch (e) {
      setError('文件解析失败，请确认是有效的 Excel / CSV 文件');
    } finally {
      setBusy(false);
    }
  };

  const handlePaste = () => {
    if (!pasteText.trim()) {
      setError('请先粘贴表格内容');
      return;
    }
    const parsed = parsePaste(pasteText);
    if (!parsed.rows.length) {
      setError('没有解析到有效行');
      return;
    }
    setError(null);
    setTable(parsed);
    setMapping(detectMapping(parsed.rows).mapping);
  };

  const doImport = () => {
    if (!table || !result) return;
    if (!result.students.length) {
      setError('没有可导入的学生，请检查姓名列映射');
      return;
    }
    importStudents(result.students, mode);
    reset();
    setOpen(false);
  };

  const headers = table
    ? table.rows[0].map((cell, index) => ({
        label: table.hasHeader ? String(cell || `第 ${index + 1} 列`) : `第 ${index + 1} 列`,
        index,
      }))
    : [];
  const dataRows = table ? table.rows.slice(table.hasHeader ? 1 : 0) : [];

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title="导入学生名单"
      subtitle="支持 Excel / CSV / 从表格直接粘贴 · 表头会自动识别"
      width={800}
      footer={
        <>
          <button
            className="btn btn-ghost"
            onClick={() => {
              reset();
              setOpen(false);
            }}
          >
            取消
          </button>
          <button
            className="btn btn-primary"
            disabled={!table || !result?.students.length}
            onClick={doImport}
            style={{ opacity: !table || !result?.students.length ? 0.5 : 1 }}
          >
            <Check size={14} />
            导入 {result?.students.length ?? 0} 名学生
          </button>
        </>
      }
    >
      {!table ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Segmented
              value={tab}
              onChange={setTab}
              options={[
                { value: 'file', label: '上传文件' },
                { value: 'paste', label: '粘贴表格' },
              ]}
            />
            <button className="btn btn-ghost text-[11.5px]" onClick={downloadTemplate}>
              <Download size={13} /> 下载模板
            </button>
          </div>

          {tab === 'file' ? (
            <div
              className={clsx(
                'dropzone flex flex-col items-center justify-center gap-3 px-6 py-12 text-center',
                dragging && 'active',
              )}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) void handleFile(file);
              }}
              onClick={() => fileRef.current?.click()}
              role="button"
              tabIndex={0}
            >
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-primary shadow-sm">
                <UploadCloud size={22} />
              </div>
              <div>
                <div className="text-[13px] font-medium">
                  {busy ? '正在解析…' : '拖拽文件到这里，或点击选择'}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">
                  支持 .xlsx / .xls / .csv，含中文表头会自动映射
                </div>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv,.txt"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFile(file);
                  e.target.value = '';
                }}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              <div className="flex items-start gap-2 rounded-[10px] bg-primary-soft px-3 py-2 text-[11px] leading-relaxed text-[#4453a8]">
                <ClipboardPaste size={13} className="mt-0.5 shrink-0" />
                在 Excel 中选中区域按 Ctrl+C，粘贴到下方即可（自动识别制表符分隔）。
              </div>
              <textarea
                className="input min-h-[180px] font-mono text-[11.5px]"
                placeholder={'学号\t姓名\t性别\t身高\t特点\n2026001\t张三\t男\t172\t数学拔尖，但坐不住'}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
              />
              <div className="flex justify-end">
                <button className="btn btn-primary" onClick={handlePaste}>
                  解析内容
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-1.5 rounded-[9px] bg-danger-soft px-3 py-2 text-[11.5px] text-[#b34a43]">
              <AlertTriangle size={13} /> {error}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 text-[10.5px] text-muted-foreground">
            <div className="rounded-[9px] bg-surface-warm px-2.5 py-2">
              <span className="font-medium text-ink">表头识别</span>
              <br />
              学号 / 姓名 / 性别 / 身高 / 特点 / 备注
            </div>
            <div className="rounded-[9px] bg-surface-warm px-2.5 py-2">
              <span className="font-medium text-ink">容错归一</span>
              <br />
              male、1、172cm 等写法自动转换
            </div>
            <div className="rounded-[9px] bg-surface-warm px-2.5 py-2">
              <span className="font-medium text-ink">特点解析</span>
              <br />
              导入后用语义引擎拆分为标签
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-[12px]">
              <span className="grid h-7 w-7 place-items-center rounded-[8px] bg-primary-soft text-primary">
                <FileSpreadsheet size={14} />
              </span>
              <span className="font-medium">{table.fileName}</span>
              <span className="text-muted-foreground">
                共 {dataRows.length} 行{table.hasHeader ? '（含表头）' : '（无表头）'}
              </span>
            </div>
            <button className="btn btn-ghost h-7 px-2 text-[11px]" onClick={reset}>
              <RefreshCw size={12} /> 重新选择
            </button>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[12px] font-semibold">表头映射</span>
              <span className="text-[10px] text-muted-foreground">姓名列必选</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {FIELDS.map((field) => (
                <label key={field.key} className="flex flex-col gap-1">
                  <span className="text-[10.5px] text-muted-foreground">
                    {field.label}
                    {field.required && <span className="ml-0.5 text-danger">*</span>}
                  </span>
                  <select
                    className="input h-8 text-[11.5px]"
                    value={mapping[field.key] ?? ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setMapping((prev) => {
                        const next = { ...prev };
                        if (value === '') delete next[field.key];
                        else next[field.key] = Number(value);
                        return next;
                      });
                    }}
                  >
                    <option value="">不使用</option>
                    {headers.map((header) => (
                      <option key={header.index} value={header.index}>
                        {header.label}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-[12px] font-semibold">数据预览</div>
            <div className="scroll-thin max-h-[220px] overflow-auto rounded-[10px] border border-line">
              <table className="w-full border-collapse text-[11px]">
                <thead>
                  <tr className="sticky top-0 bg-surface-warm">
                    {headers.map((header) => {
                      const mapped = FIELDS.find((f) => mapping[f.key] === header.index);
                      return (
                        <th
                          key={header.index}
                          className="whitespace-nowrap border-b border-line px-2.5 py-2 text-left font-medium text-muted-foreground"
                        >
                          <span className="flex items-center gap-1">
                            {header.label}
                            {mapped && (
                              <span
                                className={`rounded-[3px] px-1 text-[9px] ${FIELD_BADGE[mapped.key]}`}
                              >
                                {mapped.label}
                              </span>
                            )}
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {dataRows.slice(0, 6).map((row, rowIndex) => (
                    <tr key={rowIndex} className="odd:bg-white even:bg-[#fbfaf6]">
                      {headers.map((header) => (
                        <td
                          key={header.index}
                          className="max-w-[180px] truncate whitespace-nowrap px-2.5 py-1.5 text-[#4b4f58]"
                        >
                          {row[header.index] ?? ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {dataRows.length === 0 && (
                    <tr>
                      <td className="px-3 py-5 text-center text-muted-foreground" colSpan={headers.length}>
                        没有数据行
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[11.5px] text-muted-foreground">导入方式</span>
              <Segmented
                value={mode}
                onChange={setMode}
                options={[
                  { value: 'replace', label: '替换当前名单' },
                  { value: 'append', label: '追加到名单' },
                ]}
              />
            </div>
            <div className="text-[11px] text-muted-foreground">
              将导入{' '}
              <span className="font-semibold text-ink">{result?.students.length ?? 0}</span> 人
              {result && result.skipped > 0 && (
                <span className="ml-1 text-warn">· 跳过 {result.skipped} 行</span>
              )}
            </div>
          </div>

          {result && result.issues.length > 0 && (
            <div className="rounded-[10px] border border-[#f3e0c0] bg-[#fffaef] px-3 py-2.5">
              <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-[#a9761f]">
                <AlertTriangle size={12} /> 校验提示（{result.issues.length}）
              </div>
              <ul className="scroll-thin flex max-h-[92px] flex-col gap-0.5 overflow-y-auto text-[10.5px] text-[#8b7550]">
                {result.issues.slice(0, 20).map((issue, i) => (
                  <li key={i}>
                    第 {issue.row} 行：{issue.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-1.5 rounded-[9px] bg-danger-soft px-3 py-2 text-[11.5px] text-[#b34a43]">
              <AlertTriangle size={13} /> {error}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
