import { useMemo, useState } from 'react';
import { Save, Trash2, Wand2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import type { Gender, Student } from '../types';
import { enrichTraits } from '../lib/semantics';
import { buildSlots } from '../lib/layout';
import { Field, Modal, Segmented } from './ui';
import { uid } from '../lib/utils';
import { CATEGORY_LABEL } from '../types';

export function StudentDialog() {
  const editor = useAppStore((s) => s.studentEditor);
  const closeStudentEditor = useAppStore((s) => s.closeStudentEditor);
  const students = useAppStore((s) => s.students);
  const layout = useAppStore((s) => s.layout);
  const upsertStudent = useAppStore((s) => s.upsertStudent);
  const deleteStudent = useAppStore((s) => s.deleteStudent);

  const existing = editor.studentId
    ? students.find((s) => s.id === editor.studentId)
    : undefined;

  return (
    <Modal
      open={editor.open}
      onClose={closeStudentEditor}
      title={existing ? '编辑学生' : '添加学生'}
      subtitle="特点支持自然语言，语义引擎会自动拆分标签"
      width={560}
      footer={
        <div className="flex w-full items-center justify-between">
          <div>
            {existing && (
              <button
                className="btn btn-danger h-8 text-[11.5px]"
                onClick={() => {
                  deleteStudent(existing.id);
                  closeStudentEditor();
                }}
              >
                <Trash2 size={12} /> 删除学生
              </button>
            )}
          </div>
          <button
            className="btn btn-primary"
            type="submit"
            form="student-form"
          >
            <Save size={13} /> 保存
          </button>
        </div>
      }
    >
      {editor.open && (
        <StudentForm
          key={existing?.id ?? 'new'}
          existing={existing}
          slots={buildSlots(layout).filter((s) => !s.blocked)}
          students={students}
          onSave={(student) => upsertStudent(student)}
          onCancel={closeStudentEditor}
        />
      )}
    </Modal>
  );
}

function StudentForm({
  existing,
  slots,
  students,
  onSave,
  onCancel,
}: {
  existing?: Student;
  slots: ReturnType<typeof buildSlots>;
  students: Student[];
  onSave: (student: Student) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? '');
  const [studentNo, setStudentNo] = useState(existing?.studentNo ?? '');
  const [gender, setGender] = useState<Gender>(existing?.gender ?? 'male');
  const [height, setHeight] = useState(existing?.height ? String(existing.height) : '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [fixedSlotId, setFixedSlotId] = useState(existing?.fixedSlotId ?? '');
  const [traitsText, setTraitsText] = useState(
    existing
      ? [...new Set(existing.traits.map((t) => t.raw))].join('、')
      : '',
  );
  const [error, setError] = useState<string | null>(null);

  const previewTraits = useMemo(() => (traitsText.trim() ? enrichTraits(traitsText) : []), [traitsText]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('姓名不能为空');
      return;
    }
    const no = studentNo.trim() || `AUTO-${String(students.length + 1).padStart(3, '0')}`;
    if (students.some((s) => s.studentNo === no && s.id !== existing?.id)) {
      setError('学号已存在，请换一个');
      return;
    }
    const heightNum = height.trim() ? Number(height) : undefined;
    if (heightNum !== undefined && (Number.isNaN(heightNum) || heightNum < 100 || heightNum > 230)) {
      setError('身高需在 100–230cm 之间');
      return;
    }
    const student: Student = {
      id: existing?.id ?? uid('stu'),
      studentNo: no,
      name: trimmedName,
      gender,
      height: heightNum,
      note: note.trim(),
      traits: traitsText.trim() ? enrichTraits(traitsText) : [],
      fixedSlotId: fixedSlotId || undefined,
    };
    onSave(student);
  };

  return (
    <form id="student-form" onSubmit={submit} className="flex flex-col gap-3.5">
      <div className="grid grid-cols-2 gap-3">
        <Field label="姓名 *">
          <input
            className="input"
            value={name}
            placeholder="学生姓名"
            autoFocus
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="学号">
          <input
            className="input"
            value={studentNo}
            placeholder="留空自动生成"
            onChange={(e) => setStudentNo(e.target.value)}
          />
        </Field>
        <Field label="性别">
          <Segmented
            className="mt-0.5"
            value={gender}
            onChange={setGender}
            options={[
              { value: 'male', label: '男' },
              { value: 'female', label: '女' },
              { value: 'unknown', label: '未填' },
            ]}
          />
        </Field>
        <Field label="身高（cm）">
          <input
            className="input"
            type="number"
            min={100}
            max={230}
            value={height}
            placeholder="例如 172"
            onChange={(e) => setHeight(e.target.value)}
          />
        </Field>
      </div>

      <Field label="特点" hint="支持口语化描述，用顿号或逗号分隔，例如：数学拔尖但坐不住、近视需要前排">
        <textarea
          className="input min-h-[84px]"
          value={traitsText}
          placeholder="数学拔尖但坐不住，和谁都能聊两句……"
          onChange={(e) => setTraitsText(e.target.value)}
        />
      </Field>

      {previewTraits.length > 0 && (
        <div className="rounded-[10px] bg-surface-warm px-3 py-2.5">
          <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
            <Wand2 size={11} /> 本地语义识别结果
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {previewTraits.map((trait) => (
              <span key={trait.id} className="tag-chip bg-white">
                {trait.text}
                <span className="text-[8.5px] text-muted-foreground">· {CATEGORY_LABEL[trait.category]}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="备注">
          <input
            className="input"
            value={note}
            placeholder="其他需要说明的信息"
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
        <Field label="固定座位">
          <select
            className="input"
            value={fixedSlotId}
            onChange={(e) => setFixedSlotId(e.target.value)}
          >
            <option value="">不固定</option>
            {slots.map((slot) => (
              <option key={slot.id} value={slot.id}>
                第 {slot.row} 排 · 第 {slot.col} 座
              </option>
            ))}
          </select>
        </Field>
      </div>

      {error && (
        <div className="rounded-[9px] bg-danger-soft px-3 py-2 text-[11.5px] text-[#b34a43]">
          {error}
        </div>
      )}

      <button type="button" className="hidden" onClick={onCancel} />
    </form>
  );
}
