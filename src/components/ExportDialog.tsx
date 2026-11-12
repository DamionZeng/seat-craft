import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, FileImage, FileText, Loader2, Maximize2, Minimize2, RotateCcw } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { useAppStore } from '../store/useAppStore';
import type { Assignment, LayoutConfig, Slot, Student } from '../types';
import { buildSlots, totalCols } from '../lib/layout';
import { saveExportFile } from '../lib/saveFile';
import { Modal, Segmented, Switch } from './ui';
import clsx from 'clsx';

type Format = 'png' | 'pdf';
type ViewMode = 'teacher' | 'student';

const PAGE_COLORS = [
  { label: '纸感', color: '#F3F1EA' },
  { label: '纯白', color: '#FFFFFF' },
  { label: '冷白', color: '#F5F8FD' },
  { label: '米黄', color: '#FBF4E4' },
];

const FONTS = [
  {
    value: 'system',
    label: '系统默认',
    stack: '"HarmonyOS Sans SC", "PingFang SC", "Microsoft YaHei", "Segoe UI", sans-serif',
  },
  {
    value: 'hei',
    label: '黑体',
    stack: '"Microsoft YaHei", "PingFang SC", "Heiti SC", sans-serif',
  },
  {
    value: 'song',
    label: '宋体',
    stack: '"SimSun", "Songti SC", "STSong", serif',
  },
  {
    value: 'kai',
    label: '楷体',
    stack: '"KaiTi", "STKaiti", "Kaiti SC", serif',
  },
  {
    value: 'yuan',
    label: '圆体',
    stack: '"YouYuan", "Yuanti SC", "Microsoft YaHei", sans-serif',
  },
] as const;
type FontKey = (typeof FONTS)[number]['value'];

const CHECKER =
  'repeating-conic-gradient(#e9e5da 0% 25%, #fff 0% 50%) 50% / 12px 12px';

/** 门牌相对座位网格上下各外扩的距离，避免和座位落在同一行 */
const DOOR_OFFSET = 46;

type Metrics = {
  seatW: number;
  seatH: number;
  nameSize: number;
  aisle: number;
  rowGap: number;
  pageW: number;
  pageH: number;
};

/** 按 A4 版面反推座位尺寸，保证 80 人以内单页可打印 */
function computeMetrics(layout: LayoutConfig, header: boolean): Metrics {
  const cols = totalCols(layout);
  const landscape = cols / Math.max(1, layout.rows) >= 1.15;
  const pageW = landscape ? 1414 : 1000;
  const pageH = landscape ? 1000 : 1414;
  const pad = 32;
  const rowGap = 10;
  const aisle = 26;
  const doorRail = 56;
  const headerH = header ? 62 : 0;
  const podiumH = 54;
  const footerH = 34;
  const rowLabelW = 22;
  const labelGap = 10;
  const deskExtra = layout.deskType === 'double' ? 16 : 2;
  const availW =
    pageW -
    pad * 2 -
    doorRail -
    rowLabelW -
    labelGap -
    aisle * (layout.groups - 1) -
    deskExtra * layout.groups;
  const availH =
    pageH - pad * 2 - headerH - podiumH - footerH - DOOR_OFFSET * 2 - (layout.rows - 1) * rowGap;
  const byW = availW / cols;
  const byH = availH / layout.rows / 0.72;
  const seatW = Math.max(34, Math.min(124, Math.floor(Math.min(byW, byH))));
  const seatH = Math.round(seatW * 0.72);
  const nameSize = Math.max(9, Math.min(16, (seatW - 12) / 4, seatW * 0.2));
  return { seatW, seatH, nameSize, aisle, rowGap, pageW, pageH };
}

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
  metrics: Metrics,
): HTMLElement {
  const { seatW, seatH, nameSize } = metrics;
  if (slot.blocked) {
    const blocked = el('div', {
      width: `${seatW}px`,
      height: `${seatH}px`,
      borderRadius: '10px',
      border: '1px dashed #d9d4c7',
      backgroundColor: 'rgba(240,237,229,0.6)',
      backgroundImage:
        'repeating-linear-gradient(-45deg, rgba(108,114,128,0.06) 0px, rgba(108,114,128,0.06) 6px, transparent 6px, transparent 12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#8b8578',
      fontSize: '9.5px',
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
        width: `${seatW}px`,
        height: `${seatH}px`,
        borderRadius: '10px',
        border: '1px dashed #ddd7c9',
        backgroundColor: 'rgba(255,255,255,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#c4beb0',
        fontSize: `${Math.max(10, Math.round(seatH * 0.24))}px`,
        boxSizing: 'border-box',
      },
      '+',
    );
  }

  const seat = el('div', {
    width: `${seatW}px`,
    height: `${seatH}px`,
    borderRadius: '10px',
    border: '1px solid #e7e2d5',
    backgroundColor: '#ffffff',
    boxShadow: '0 1px 2px rgba(16,24,40,0.05)',
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 6px',
    overflow: 'hidden',
  });
  seat.appendChild(
    el(
      'span',
      {
        fontSize: `${nameSize}px`,
        fontWeight: '600',
        color: '#1b1e25',
        letterSpacing: '0.01em',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        textAlign: 'center',
      },
      student.name,
    ),
  );
  return seat;
}

function buildExportSheet(options: {
  className: string;
  subtitle: string;
  layout: LayoutConfig;
  students: Student[];
  assignment: Assignment;
  view: ViewMode;
  pageColor: string;
  transparent: boolean;
  fontFamily: string;
  nameSize: number | null;
  header: boolean;
}) {
  const { layout, students, assignment, view, pageColor, transparent, header, fontFamily } =
    options;
  const slots = buildSlots(layout);
  const studentById = new Map(students.map((s) => [s.id, s]));
  const auto = computeMetrics(layout, header);
  const metrics = options.nameSize ? { ...auto, nameSize: options.nameSize } : auto;
  const { aisle, rowGap, pageW, pageH } = metrics;
  const bg = transparent ? 'transparent' : pageColor;
  const frontAtTop = view === 'student';
  const doorOnRight = view === 'student';

  const sheet = el('div', {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: `${pageW}px`,
    minHeight: `${pageH}px`,
    padding: '32px',
    boxSizing: 'border-box',
    borderRadius: '24px',
    border: transparent ? '1px solid transparent' : '1px solid #e6e2d8',
    background: bg,
    fontFamily,
  });

  if (header) {
    const head = el('div', {
      alignSelf: 'stretch',
      marginBottom: '14px',
    });
    head.appendChild(
      el(
        'div',
        { fontSize: '22px', fontWeight: '600', color: '#1b1e25', letterSpacing: '-0.01em' },
        options.className,
      ),
    );
    head.appendChild(
      el(
        'div',
        { marginTop: '5px', fontSize: '10.5px', color: '#6c7280', letterSpacing: '0.04em' },
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
      margin: '4px 0 10px',
      flexShrink: '0',
    });
    wrap.appendChild(
      el(
        'div',
        {
          width: '360px',
          height: '40px',
          borderRadius: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(255,255,255,0.92)',
          fontSize: '10px',
          letterSpacing: '0.5em',
          background: 'linear-gradient(180deg, #262b35 0%, #1c1f26 100%)',
          boxShadow: '0 6px 16px rgba(28,31,38,0.18)',
          transform: doorOnRight ? 'translateX(-28px)' : 'translateX(28px)',
        },
        '讲 台',
      ),
    );
    return wrap;
  };

  const doorBadge = (label: string, front: boolean) =>
    el(
      'div',
      {
        fontSize: '10px',
        letterSpacing: '0.09em',
        color: front ? '#3b4a7a' : '#6f6a5f',
        border: '1px solid #e3ddcf',
        borderLeft: `3px solid ${front ? '#3D5AFE' : '#b9b3a5'}`,
        backgroundColor: '#fffdf8',
        borderRadius: '8px',
        padding: '6px 2px',
        textAlign: 'center',
        boxShadow: '0 1px 2px rgba(16,24,40,0.04)',
      },
      label,
    );

  const gridHeight =
    layout.rows * (metrics.seatH + (layout.deskType === 'double' ? 10 : 0)) +
    (layout.rows - 1) * rowGap;

  const doorRail = (frontAtTop: boolean) => {
    const rail = el('div', {
      width: '56px',
      height: `${gridHeight + DOOR_OFFSET * 2}px`,
      flexShrink: '0',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '0 6px',
      boxSizing: 'border-box',
    });
    rail.appendChild(frontAtTop ? doorBadge('前门', true) : doorBadge('后门', false));
    rail.appendChild(frontAtTop ? doorBadge('后门', false) : doorBadge('前门', true));
    return rail;
  };

  const aisleGap = () => {
    const gap = el('div', {
      width: `${aisle}px`,
      alignSelf: 'stretch',
      display: 'flex',
      justifyContent: 'center',
    });
    gap.appendChild(
      el('div', {
        width: '0',
        height: '100%',
        borderLeft: '1px dashed #d8d1c2',
      }),
    );
    return gap;
  };

  const rows = el('div', {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: `${rowGap}px`,
  });

  const rowNumbers: number[] = [];
  for (let row = 1; row <= layout.rows; row++) rowNumbers.push(row);
  if (view === 'teacher') rowNumbers.reverse();

  for (const row of rowNumbers) {
    const rowWrap = el('div', {
      display: 'flex',
      alignItems: 'center',
      gap: '0',
    });
    rowWrap.appendChild(
      el(
        'span',
        {
          width: '22px',
          marginRight: '10px',
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

    groupNumbers.forEach((group, index) => {
      if (index > 0) rowWrap.appendChild(aisleGap());
      const groupSlots = slots
        .filter((s) => s.row === row && s.group === group)
        .sort((a, b) => a.indexInGroup - b.indexInGroup);
      if (view === 'teacher') groupSlots.reverse();

      const desk = el('div', {
        display: 'flex',
        gap: layout.deskType === 'double' ? '6px' : '0',
        padding: layout.deskType === 'double' ? '4px' : '0',
        borderRadius: layout.deskType === 'double' ? '14px' : '0',
        border: layout.deskType === 'double' ? '1px solid #e8e3d6' : 'none',
        backgroundColor:
          layout.deskType === 'double' ? 'rgba(255,255,255,0.45)' : 'transparent',
      });

      for (const slot of groupSlots) {
        const studentId = assignment[slot.id];
        desk.appendChild(
          buildSeat(slot, studentId ? studentById.get(studentId) : undefined, metrics),
        );
      }
      rowWrap.appendChild(desk);
    });
    rows.appendChild(rowWrap);
  }

  const gridWrap = el('div', {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  });
  gridWrap.appendChild(rows);

  const classroom = el('div', {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    flex: '1',
    margin: '4px 0',
  });
  if (!doorOnRight) classroom.appendChild(doorRail(frontAtTop));
  classroom.appendChild(gridWrap);
  if (doorOnRight) classroom.appendChild(doorRail(frontAtTop));

  if (frontAtTop) sheet.appendChild(podium());
  sheet.appendChild(classroom);
  if (!frontAtTop) sheet.appendChild(podium());

  sheet.appendChild(
    el(
      'div',
      {
        marginTop: '8px',
        alignSelf: 'stretch',
        display: 'flex',
        justifyContent: 'center',
        fontSize: '9.5px',
        color: '#a09a8c',
        letterSpacing: '0.06em',
        flexShrink: '0',
      },
      `虚线为过道 · 前门/后门位于讲台同侧 · ${layout.deskType === 'double' ? '双人桌' : '单人桌'} · ${layout.groups} 组 · ${layout.rows} 排 · ${totalCols(layout)} 列 · ${students.length} 人`,
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

/** 实时缩略预览：直接挂载真实导出画布，按容器宽度等比缩放 */
function SheetPreview({ sheet, maxHeight }: { sheet: HTMLElement; maxHeight?: number }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(200);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const stage = document.createElement('div');
    stage.style.cssText = 'position:absolute;top:0;left:0;transform-origin:top left;';
    stage.appendChild(sheet);
    host.appendChild(stage);

    const update = () => {
      const naturalW = sheet.offsetWidth || 1;
      const naturalH = sheet.offsetHeight || 1;
      const byWidth = host.clientWidth / naturalW;
      const byHeight = maxHeight ? maxHeight / naturalH : byWidth;
      const nextScale = Math.min(byWidth, byHeight);
      stage.style.left = `${Math.max(0, (host.clientWidth - naturalW * nextScale) / 2)}px`;
      stage.style.transform = `scale(${nextScale})`;
      const nextHeight = Math.max(1, Math.round(naturalH * nextScale));
      setHeight((prev) => (prev === nextHeight ? prev : nextHeight));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(host);
    return () => {
      observer.disconnect();
      stage.remove();
    };
  }, [sheet, maxHeight]);

  return <div ref={hostRef} className="relative w-full overflow-hidden" style={{ height }} />;
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

  const [format, setFormat] = useState<Format>('png');
  const [pageColor, setPageColor] = useState(PAGE_COLORS[0].color);
  const [transparent, setTransparent] = useState(false);
  const [font, setFont] = useState<FontKey>('system');
  const [nameSize, setNameSize] = useState<number | null>(null);
  const [header, setHeader] = useState(true);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!open) setExpanded(false);
  }, [open]);

  const stamp = fileStamp();
  const filename = `${className.replace(/[\\/:*?"<>|]/g, '_')}_座位表_${stamp}.${format}`;
  const viewLabel = view === 'teacher' ? '讲台视角' : '学生视角';
  const deskLabel = layout.deskType === 'double' ? '双人桌' : '单人桌';
  const subtitle = `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)} · ${viewLabel} · ${deskLabel} ${layout.rows} 排 × ${layout.groups} 组 · ${students.length} 人`;

  const autoNameSize = useMemo(() => computeMetrics(layout, header).nameSize, [layout, header]);
  const fontSize = nameSize ?? autoNameSize;
  const fontStack = FONTS.find((f) => f.value === font)?.stack ?? FONTS[0].stack;

  const sheet = useMemo(
    () =>
      buildExportSheet({
        className,
        subtitle,
        layout,
        students,
        assignment,
        view,
        pageColor,
        transparent,
        fontFamily: fontStack,
        nameSize,
        header,
      }),
    [
      className,
      subtitle,
      layout,
      students,
      assignment,
      view,
      pageColor,
      transparent,
      fontStack,
      nameSize,
      header,
    ],
  );

  const handleExport = async () => {
    if (!Object.keys(assignment).length) {
      notify('当前还没有座位结果，请先智能排座', 'warn');
      return;
    }
    setBusy(true);
    const stage = document.createElement('div');
    stage.style.cssText = 'position:fixed;left:-100000px;top:0;pointer-events:none;z-index:-1;';
    const exportSheet = buildExportSheet({
      className,
      subtitle,
      layout,
      students,
      assignment,
      view,
      pageColor,
      transparent,
      fontFamily: fontStack,
      nameSize,
      header,
    });
    stage.appendChild(exportSheet);
    document.body.appendChild(stage);
    try {
      const bgColor = transparent ? undefined : pageColor;
      // PDF 用 JPEG 内嵌：jsPDF 处理大尺寸 PNG 会同步解压重编码，耗时不可接受
      const dataUrl =
        format === 'png'
          ? await rasterize(exportSheet, 2, bgColor)
          : await rasterize(exportSheet, 2, bgColor ?? '#FFFFFF', 'image/jpeg');

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
    <>
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
                { value: 'png' as Format, label: '高清 PNG', desc: '发群 / 插图，背景可自定义', icon: FileImage },
                { value: 'pdf' as Format, label: '打印 PDF', desc: 'A4 单页自适应，80 人内可打印', icon: FileText },
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
              <span className="field-label">页面颜色</span>
              <div className="flex flex-wrap items-center gap-1.5">
                {PAGE_COLORS.map((item) => {
                  const active = !transparent && pageColor.toLowerCase() === item.color.toLowerCase();
                  return (
                    <button
                      key={item.color}
                      type="button"
                      onClick={() => {
                        setPageColor(item.color);
                        setTransparent(false);
                      }}
                      className={clsx(
                        'flex h-[30px] items-center gap-1.5 rounded-[8px] border px-2 text-[11.5px] transition-colors',
                        active
                          ? 'border-[rgba(61,90,254,0.5)] bg-white text-ink'
                          : 'border-line bg-white/60 text-muted-foreground hover:text-ink',
                      )}
                    >
                      <span
                        className="h-3.5 w-3.5 rounded-[4px] border border-line-strong"
                        style={{ background: item.color }}
                      />
                      {item.label}
                    </button>
                  );
                })}
                <label
                  className={clsx(
                    'flex h-[30px] cursor-pointer items-center gap-1.5 rounded-[8px] border px-2 text-[11.5px] transition-colors',
                    transparent
                      ? 'border-line bg-white/60 text-muted-foreground hover:text-ink'
                      : 'border-[rgba(61,90,254,0.5)] bg-white text-ink',
                  )}
                  title="自定义页面颜色"
                >
                  <input
                    type="color"
                    value={pageColor}
                    onChange={(e) => {
                      setPageColor(e.target.value);
                      setTransparent(false);
                    }}
                    className="h-4 w-4 cursor-pointer rounded-[3px] border-0 bg-transparent p-0"
                  />
                  自定义
                </label>
              </div>
              <div className="flex items-center gap-1.5">
                <Switch checked={transparent} onChange={setTransparent} />
                <span className="text-[11px] text-muted-foreground">透明背景（仅 PNG 生效）</span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="field-label">字体类型</span>
              <select
                className="input"
                value={font}
                onChange={(e) => setFont(e.target.value as FontKey)}
              >
                {FONTS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-muted-foreground">应用于整张座位表的文字</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="field-label">姓名字号</span>
              <Segmented
                value={nameSize === null ? 'auto' : 'custom'}
                onChange={(next) => setNameSize(next === 'auto' ? null : autoNameSize)}
                options={[
                  { value: 'auto', label: '自适应' },
                  { value: 'custom', label: '自定义' },
                ]}
              />
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={8}
                max={28}
                step={1}
                value={fontSize}
                onChange={(e) => setNameSize(Number(e.target.value))}
                className="slider"
                style={{ ['--fill' as any]: `${((fontSize - 8) / 20) * 100}%` }}
              />
              <span className="w-10 shrink-0 text-right text-[12px] font-medium tabular-nums text-ink">
                {fontSize}px
              </span>
              {nameSize !== null && (
                <button
                  type="button"
                  className="icon-btn"
                  title="恢复自适应字号"
                  onClick={() => setNameSize(null)}
                >
                  <RotateCcw size={13} />
                </button>
              )}
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
              <span>导出预览 · {format.toUpperCase()} · 2x</span>
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="flex items-center gap-1 rounded-[6px] px-1.5 py-0.5 transition-colors hover:bg-black/5 hover:text-ink"
              >
                <Maximize2 size={11} /> 展开
              </button>
            </div>
            <div className="p-3">
              <div
                className="overflow-hidden rounded-[10px]"
                style={{ background: transparent ? CHECKER : undefined }}
              >
                {expanded ? (
                  <div className="grid h-[180px] place-items-center text-[11px] text-muted-foreground">
                    预览已展开
                  </div>
                ) : (
                  <SheetPreview sheet={sheet} />
                )}
              </div>
            </div>
            <div className="px-3.5 pb-3 text-[11px] text-muted-foreground">
              文件名：<span className="font-medium text-ink">{filename}</span>
            </div>
          </div>
        </div>
      </Modal>

      {expanded &&
        createPortal(
          <div className="fixed inset-0 z-[120] flex flex-col bg-[rgba(18,20,26,0.66)] backdrop-blur-[2px]">
            <div className="flex items-center justify-between px-6 py-4">
              <div className="text-white">
                <div className="text-[14px] font-semibold">导出预览</div>
                <div className="mt-0.5 text-[11px] text-white/55">
                  {format.toUpperCase()} · 2x · {transparent ? '透明背景' : pageColor} · {fontSize}px
                </div>
              </div>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="flex h-8 items-center gap-1.5 rounded-[9px] bg-white/10 px-3 text-[12px] text-white transition-colors hover:bg-white/20"
              >
                <Minimize2 size={13} /> 收起
              </button>
            </div>
            <div className="scroll-thin min-h-0 flex-1 overflow-auto px-6 pb-6">
              <div
                className="mx-auto w-full max-w-[1440px] overflow-hidden rounded-[16px] shadow-[0_30px_80px_rgba(0,0,0,0.35)]"
                style={{ background: transparent ? CHECKER : undefined }}
              >
                <SheetPreview sheet={sheet} maxHeight={window.innerHeight - 170} />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
