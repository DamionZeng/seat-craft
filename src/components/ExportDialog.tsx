import { useState } from 'react';
import { Download, FileImage, FileText, Loader2 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { useAppStore } from '../store/useAppStore';
import type { Assignment, LayoutConfig, Slot, Student } from '../types';
import { buildSlots, totalCols } from '../lib/layout';
import { saveExportFile } from '../lib/saveFile';
import { Modal, Segmented, Switch } from './ui';
import clsx from 'clsx';

type Format = 'png' | 'pdf';
type Background = 'paper' | 'white' | 'transparent';
type ViewMode = 'teacher' | 'student';

const BACKGROUNDS: { value: Background; label: string; color: string }[] = [
  { value: 'paper', label: '纸感', color: '#F3F1EA' },
  { value: 'white', label: '纯白', color: '#FFFFFF' },
  { value: 'transparent', label: '透明', color: 'transparent' },
];

const CATEGORY_COLOR: Record<string, string> = {
  behavior: '#E5A23C',
  study: '#3D5AFE',
  personality: '#3FB68B',
  other: '#A7A29A',
};

const SEAT_W = 104;
const SEAT_H = 74;

function fileStamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片渲染失败'));
    img.src = src;
  });
}

function el(tag: string, style: Record<string, string>, text?: string) {
  const node = document.createElement(tag);
  Object.assign(node.style, style);
  if (text) node.textContent = text;
  return node;
}

function buildSeat(
  slot: Slot,
  student: Student | undefined,
  manual: boolean,
): HTMLElement {
  if (slot.blocked) {
    const blocked = el('div', {
      width: `${SEAT_W}px`,
      height: `${SEAT_H}px`,
      borderRadius: '12px',
      border: '1px dashed #d9d4c7',
      backgroundColor: 'rgba(240,237,229,0.6)',
      backgroundImage:
        'repeating-linear-gradient(-45deg, rgba(108,114,128,0.06) 0px, rgba(108,114,128,0.06) 6px, transparent 6px, transparent 12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#6c7280',
      fontSize: '10px',
      letterSpacing: '0.08em',
      boxSizing: 'border-box',
    });
    blocked.textContent = '禁区';
    return blocked;
  }

  if (!student) {
    return el(
      'div',
      {
        width: `${SEAT_W}px`,
        height: `${SEAT_H}px`,
        borderRadius: '12px',
        border: '1px dashed #d5cfc1',
        backgroundColor: 'rgba(255,255,255,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#b9b3a5',
        fontSize: '15px',
        boxSizing: 'border-box',
      },
      '+',
    );
  }

  const seat = el('div', {
    width: `${SEAT_W}px`,
    height: `${SEAT_H}px`,
    borderRadius: '12px',
    border: '1px solid #eae6dc',
    backgroundColor: '#ffffff',
    boxSizing: 'border-box',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    padding: '0 7px 0 11px',
    overflow: 'hidden',
  });

  const bar = el('span', {
    position: 'absolute',
    left: '0',
    top: '0',
    bottom: '0',
    width: '3px',
    background:
      student.gender === 'male'
        ? 'linear-gradient(180deg,#7BA6F5,#5B8DEF)'
        : student.gender === 'female'
          ? 'linear-gradient(180deg,#F0A5B7,#E8829B)'
          : '#D8D3C6',
  });
  seat.appendChild(bar);

  if (manual) {
    seat.appendChild(
      el('span', {
        position: 'absolute',
        right: '5px',
        top: '5px',
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        backgroundColor: '#F2A65A',
      }),
    );
  }

  const nameRow = el('div', {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    marginBottom: '4px',
  });
  nameRow.appendChild(
    el(
      'span',
      {
        fontSize: '13.5px',
        fontWeight: '600',
        color: '#1b1e25',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      },
      student.name,
    ),
  );
  if (student.fixedSlotId) {
    nameRow.appendChild(
      el('span', {
        fontSize: '9px',
        color: '#3D5AFE',
        flexShrink: '0',
      }, '●'),
    );
  }
  seat.appendChild(nameRow);

  const metaRow = el('div', {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
  });
  if (student.height !== undefined) {
    metaRow.appendChild(
      el(
        'span',
        {
          fontSize: '9.5px',
          fontWeight: '500',
          color: '#b0722a',
          backgroundColor: '#fdf1e3',
          borderRadius: '4px',
          padding: '1px 4px',
          lineHeight: '1.4',
        },
        String(student.height),
      ),
    );
  }
  metaRow.appendChild(
    el(
      'span',
      {
        fontSize: '9px',
        color: '#6c7280',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      },
      student.studentNo,
    ),
  );

  const tags = [...new Map(student.traits.map((t) => [t.text, t])).values()];
  const dots = el('span', {
    marginLeft: 'auto',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '3px',
    flexShrink: '0',
  });
  for (const tag of tags.slice(0, 3)) {
    dots.appendChild(
      el('span', {
        width: '5px',
        height: '5px',
        borderRadius: '50%',
        backgroundColor: CATEGORY_COLOR[tag.category] ?? CATEGORY_COLOR.other,
      }),
    );
  }
  metaRow.appendChild(dots);
  seat.appendChild(metaRow);

  return seat;
}

function buildExportSheet(options: {
  className: string;
  subtitle: string;
  layout: LayoutConfig;
  students: Student[];
  assignment: Assignment;
  manualSlots: Record<string, true>;
  view: ViewMode;
  background: Background;
  header: boolean;
}) {
  const { layout, students, assignment, manualSlots, view, background, header } = options;
  const slots = buildSlots(layout);
  const studentById = new Map(students.map((s) => [s.id, s]));
  const bg =
    background === 'transparent' ? 'transparent' : background === 'white' ? '#FFFFFF' : '#F3F1EA';

  const sheet = el('div', {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: 'max-content',
    padding: '24px 34px 30px',
    boxSizing: 'border-box',
    borderRadius: '26px',
    border: background === 'transparent' ? '1px solid transparent' : '1px solid #e6e2d8',
    background: bg,
    fontFamily: '"HarmonyOS Sans SC", "PingFang SC", "Microsoft YaHei", "Segoe UI", sans-serif',
  });

  if (header) {
    const head = el('div', {
      alignSelf: 'stretch',
      marginBottom: '16px',
    });
    head.appendChild(
      el(
        'div',
        { fontSize: '20px', fontWeight: '600', color: '#1b1e25', letterSpacing: '-0.01em' },
        options.className,
      ),
    );
    head.appendChild(
      el(
        'div',
        { marginTop: '4px', fontSize: '11px', color: '#6c7280' },
        options.subtitle,
      ),
    );
    sheet.appendChild(head);
  }

  const podium = () => {
    const wrap = el('div', {
      display: 'flex',
      justifyContent: 'center',
      width: '100%',
      margin: '6px 0 12px',
    });
    wrap.appendChild(
      el(
        'div',
        {
          width: '380px',
          height: '40px',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(255,255,255,0.9)',
          fontSize: '10px',
          letterSpacing: '0.5em',
          background: 'linear-gradient(180deg, #262b35 0%, #1c1f26 100%)',
        },
        '讲 台',
      ),
    );
    return wrap;
  };

  if (view === 'student') sheet.appendChild(podium());

  const rows = el('div', {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
  });

  const rowNumbers: number[] = [];
  for (let row = 1; row <= layout.rows; row++) rowNumbers.push(row);
  if (view === 'teacher') rowNumbers.reverse();

  for (const row of rowNumbers) {
    const rowWrap = el('div', {
      display: 'flex',
      alignItems: 'center',
      gap: '22px',
    });
    rowWrap.appendChild(
      el(
        'span',
        {
          width: '18px',
          textAlign: 'center',
          fontSize: '9px',
          color: '#a9a396',
          flexShrink: '0',
        },
        String(row),
      ),
    );

    const groupNumbers: number[] = [];
    for (let g = 1; g <= layout.groups; g++) groupNumbers.push(g);
    if (view === 'teacher') groupNumbers.reverse();

    for (const group of groupNumbers) {
      const groupSlots = slots
        .filter((s) => s.row === row && s.group === group)
        .sort((a, b) => a.indexInGroup - b.indexInGroup);
      if (view === 'teacher') groupSlots.reverse();

      const desk = el('div', {
        display: 'flex',
        gap: layout.deskType === 'double' ? '8px' : '0',
        padding: layout.deskType === 'double' ? '5px' : '0',
        borderRadius: layout.deskType === 'double' ? '16px' : '0',
        border: layout.deskType === 'double' ? '1px solid #e6e2d8' : 'none',
        backgroundColor:
          layout.deskType === 'double' ? 'rgba(255,255,255,0.4)' : 'transparent',
      });

      for (const slot of groupSlots) {
        const studentId = assignment[slot.id];
        desk.appendChild(
          buildSeat(slot, studentId ? studentById.get(studentId) : undefined, !!manualSlots[slot.id]),
        );
      }
      rowWrap.appendChild(desk);
    }
    rows.appendChild(rowWrap);
  }

  sheet.appendChild(rows);

  if (view === 'teacher') sheet.appendChild(podium());

  sheet.appendChild(
    el(
      'div',
      {
        marginTop: '12px',
        fontSize: '9.5px',
        color: '#a9a396',
        letterSpacing: '0.14em',
      },
      `${layout.deskType === 'double' ? '双人桌' : '单人桌'} · ${layout.groups} 组 · ${layout.rows} 排 · ${totalCols(layout)} 列 · ${students.length} 人`,
    ),
  );

  return sheet;
}

/**
 * 把离线构建的静态 DOM 序列化为 SVG(foreignObject) 再栅格化。
 * 导出画布完全由内联样式构成，不依赖全局 CSS 与外部字体，
 * 因此一次导出只需几十毫秒。
 */
async function rasterize(
  sheet: HTMLElement,
  scale: number,
  bgColor: string | undefined,
  type: 'image/png' | 'image/jpeg' = 'image/png',
): Promise<string> {
  const width = Math.ceil(sheet.offsetWidth);
  const height = Math.ceil(sheet.offsetHeight);
  sheet.style.width = `${width}px`;

  const html = new XMLSerializer().serializeToString(sheet);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<foreignObject width="100%" height="100%">${html}</foreignObject></svg>`;
  const image = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建导出画布');
  if (bgColor) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.scale(scale, scale);
  ctx.drawImage(image, 0, 0, width, height);
  return type === 'image/jpeg' ? canvas.toDataURL(type, 0.95) : canvas.toDataURL(type);
}

export function ExportDialog() {
  const open = useAppStore((s) => s.exportOpen);
  const setExportOpen = useAppStore((s) => s.setExportOpen);
  const notify = useAppStore((s) => s.notify);
  const className = useAppStore((s) => s.className);
  const view = useAppStore((s) => s.view);
  const layout = useAppStore((s) => s.layout);
  const students = useAppStore((s) => s.students);
  const assignment = useAppStore((s) => s.assignment);
  const manualSlots = useAppStore((s) => s.manualSlots);

  const [format, setFormat] = useState<Format>('png');
  const [scale, setScale] = useState('2');
  const [background, setBackground] = useState<Background>('paper');
  const [header, setHeader] = useState(true);
  const [busy, setBusy] = useState(false);

  const stamp = fileStamp();
  const filename = `${className.replace(/[\\/:*?"<>|]/g, '_')}_座位表_${stamp}.${format}`;
  const viewLabel = view === 'teacher' ? '讲台视角' : '学生视角';
  const deskLabel = layout.deskType === 'double' ? '双人桌' : '单人桌';
  const subtitle = `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)} · ${viewLabel} · ${deskLabel} ${layout.rows} 排 × ${layout.groups} 组 · ${students.length} 人`;

  const handleExport = async () => {
    if (!Object.keys(assignment).length) {
      notify('当前还没有座位结果，请先智能排座', 'warn');
      return;
    }
    setBusy(true);
    const stage = document.createElement('div');
    stage.style.cssText = 'position:fixed;left:-100000px;top:0;pointer-events:none;z-index:-1;';
    const sheet = buildExportSheet({
      className,
      subtitle,
      layout,
      students,
      assignment,
      manualSlots,
      view,
      background,
      header,
    });
    stage.appendChild(sheet);
    document.body.appendChild(stage);
    try {
      const bgColor =
        background === 'paper' ? '#F3F1EA' : background === 'white' ? '#FFFFFF' : undefined;
      // PDF 用 JPEG 内嵌：jsPDF 处理大尺寸 PNG 会同步解压重编码，耗时不可接受
      const dataUrl =
        format === 'png'
          ? await rasterize(sheet, Number(scale), bgColor)
          : await rasterize(sheet, Number(scale), bgColor ?? '#FFFFFF', 'image/jpeg');

      let save: () => Promise<void>;
      if (format === 'png') {
        save = () => saveExportFile(filename, dataUrl, 'png');
      } else {
        const image = await loadImage(dataUrl);
        const landscape = image.width >= image.height;
        const pdf = new jsPDF({
          orientation: landscape ? 'landscape' : 'portrait',
          unit: 'pt',
          format: 'a4',
        });
        const pageW = pdf.internal.pageSize.getWidth();
        const pageH = pdf.internal.pageSize.getHeight();
        const margin = 30;
        const fit = Math.min((pageW - margin * 2) / image.width, (pageH - margin * 2) / image.height);
        const w = image.width * fit;
        const h = image.height * fit;
        pdf.addImage(dataUrl, 'JPEG', (pageW - w) / 2, (pageH - h) / 2, w, h);
        save = () => saveExportFile(filename, pdf.output('datauristring'), 'pdf');
      }

      notify(`已导出 ${filename}`, 'success');
      setExportOpen(false);
      // 等弹窗收起后再触发保存，避免系统保存对话框把界面卡在“正在生成”
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          save().catch(() => notify('保存失败，请重试或检查目标文件夹权限', 'danger'));
        });
      });
    } catch (error) {
      notify(error instanceof Error ? error.message : '导出失败，请重试', 'danger');
    } finally {
      stage.remove();
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => setExportOpen(false)}
      title="导出座位表"
      subtitle="按当前视角与布局生成图片，文件名自动带上班级与日期"
      width={600}
      footer={
        <>
          <button className="btn btn-ghost" onClick={() => setExportOpen(false)}>
            取消
          </button>
          <button
            className="btn btn-primary"
            onClick={handleExport}
            disabled={busy}
            style={{ opacity: busy ? 0.75 : 1 }}
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {busy ? '正在生成…' : `导出 ${format.toUpperCase()}`}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              { value: 'png' as Format, label: '高清 PNG', desc: '发群 / 插图，背景可选', icon: FileImage },
              { value: 'pdf' as Format, label: '打印 PDF', desc: 'A4 自动排版，适合打印', icon: FileText },
            ]
          ).map((item) => {
            const Icon = item.icon;
            const active = format === item.value;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setFormat(item.value)}
                className={clsx(
                  'flex items-start gap-3 rounded-[14px] border px-3.5 py-3 text-left transition-all',
                  active
                    ? 'border-[rgba(61,90,254,0.5)] bg-primary-soft shadow-[0_6px_18px_rgba(61,90,254,0.12)]'
                    : 'border-line bg-white hover:border-line-strong',
                )}
              >
                <span
                  className={clsx(
                    'grid h-9 w-9 shrink-0 place-items-center rounded-[10px]',
                    active ? 'bg-white text-primary' : 'bg-[#f5f3ec] text-muted-foreground',
                  )}
                >
                  <Icon size={17} />
                </span>
                <span>
                  <span className="block text-[12.5px] font-semibold">{item.label}</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{item.desc}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-5">
          <div className="flex flex-col gap-1.5">
            <span className="field-label">清晰度</span>
            <Segmented
              value={scale}
              onChange={setScale}
              options={[
                { value: '1', label: '1x' },
                { value: '2', label: '2x' },
                { value: '3', label: '3x' },
              ]}
            />
            <span className="text-[11px] text-muted-foreground">3x 适合打印，文件体积更大</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="field-label">背景</span>
            <div className="flex items-center gap-1.5">
              {BACKGROUNDS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setBackground(item.value)}
                  className={clsx(
                    'flex h-[30px] items-center gap-1.5 rounded-[8px] border px-2 text-[11.5px] transition-colors',
                    background === item.value
                      ? 'border-[rgba(61,90,254,0.5)] bg-white text-ink'
                      : 'border-line bg-white/60 text-muted-foreground hover:text-ink',
                  )}
                >
                  <span
                    className="h-3.5 w-3.5 rounded-[4px] border border-line-strong"
                    style={{
                      background:
                        item.color === 'transparent'
                          ? 'repeating-conic-gradient(#e9e5da 0% 25%, #fff 0% 50%) 50% / 6px 6px'
                          : item.color,
                    }}
                  />
                  {item.label}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-muted-foreground">透明背景仅 PNG 生效</span>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-[12px] border border-line bg-surface-warm px-3.5 py-2.5">
          <div>
            <div className="text-[12.5px] font-medium">添加标题栏</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">班级名 + 日期 + 视角 + 布局说明</div>
          </div>
          <Switch checked={header} onChange={setHeader} />
        </div>

        <div className="overflow-hidden rounded-[14px] border border-line bg-[#faf9f5]">
          <div className="flex items-center justify-between border-b border-line px-3.5 py-2 text-[10.5px] text-muted-foreground">
            <span>导出预览</span>
            <span className="tabular-nums">{format.toUpperCase()} · {scale}x</span>
          </div>
          <div
            className="m-3 rounded-[10px] border border-line px-4 py-3"
            style={{
              background:
                background === 'transparent'
                  ? 'repeating-conic-gradient(#e9e5da 0% 25%, #fff 0% 50%) 50% / 12px 12px'
                  : background === 'white'
                    ? '#fff'
                    : '#F3F1EA',
            }}
          >
            {header && (
              <div className="mb-2.5">
                <div className="text-[13px] font-semibold">{className}</div>
                <div className="mt-0.5 text-[9.5px] text-muted-foreground">{subtitle}</div>
              </div>
            )}
            <div className="grid grid-cols-6 gap-1 border-t border-dashed border-line-strong/70 pt-2.5">
              {Array.from({ length: 18 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[13px] rounded-[3px] border border-[#e3ded1]"
                  style={{
                    background:
                      i % 7 === 5 ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.92)',
                  }}
                />
              ))}
            </div>
          </div>
          <div className="px-3.5 pb-3 text-[11px] text-muted-foreground">
            文件名：<span className="font-medium text-ink">{filename}</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
