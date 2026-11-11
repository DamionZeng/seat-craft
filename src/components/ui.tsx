import { motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet';
import { Switch as SwitchPrimitive } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Field as FieldPrimitive, FieldDescription, FieldLabel } from '@/components/ui/field';

export function Switch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <SwitchPrimitive
      checked={checked}
      onCheckedChange={onChange}
      disabled={disabled}
      className="data-checked:bg-primary data-unchecked:bg-line-strong"
    />
  );
}

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (next: T) => void;
  className?: string;
}) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(next) => {
        if (next) onChange(next as T);
      }}
      spacing={2}
      className={cn(
        'inline-flex w-fit items-center rounded-[10px] border border-line bg-[#f4f1e9] p-0.5',
        className,
      )}
    >
      {options.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          className="h-[26px] min-w-0 rounded-[8px] px-2.5 text-[12px] font-medium text-muted-foreground transition-all duration-200 hover:bg-transparent hover:text-ink data-[state=on]:bg-card data-[state=on]:text-ink data-[state=on]:shadow-[0_1px_3px_rgba(16,24,40,0.12)]"
        >
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <FieldPrimitive className={cn('gap-1.5', className)}>
      <FieldLabel className="field-label w-full text-[11px] font-semibold tracking-[0.04em] text-muted-foreground uppercase">
        {label}
      </FieldLabel>
      {children}
      {hint && (
        <FieldDescription className="text-[11px] leading-snug text-muted-foreground">
          {hint}
        </FieldDescription>
      )}
    </FieldPrimitive>
  );
}

function SheetHeaderBlock({ title, subtitle }: { title: ReactNode; subtitle?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
      <div className="min-w-0">
        <SheetTitle className="text-[15px] font-semibold tracking-[-0.01em] text-ink">
          {title}
        </SheetTitle>
        {subtitle && (
          <SheetDescription className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
            {subtitle}
          </SheetDescription>
        )}
      </div>
      <SheetClose asChild>
        <button
          className="grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-ink/5 hover:text-ink"
          aria-label="关闭"
        >
          <X className="size-4" />
        </button>
      </SheetClose>
    </div>
  );
}

function DialogHeaderBlock({ title, subtitle }: { title: ReactNode; subtitle?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
      <div className="min-w-0">
        <DialogTitle className="text-[16px] font-semibold tracking-[-0.01em] text-ink">
          {title}
        </DialogTitle>
        {subtitle && (
          <DialogDescription className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
            {subtitle}
          </DialogDescription>
        )}
      </div>
      <DialogClose asChild>
        <button
          className="grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-ink/5 hover:text-ink"
          aria-label="关闭"
        >
          <X className="size-4" />
        </button>
      </DialogClose>
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          'flex max-h-[calc(100vh-64px)] w-full flex-col gap-0 overflow-hidden rounded-[20px] border border-line/70 bg-popover p-0 shadow-[0_32px_80px_rgba(16,24,40,0.24)] duration-200',
          'data-open:slide-in-from-bottom-2 data-open:zoom-in-[0.985] data-closed:zoom-out-[0.99]',
        )}
        style={width ? { maxWidth: `min(${width}px, calc(100vw - 48px))` } : undefined}
      >
        <DialogHeaderBlock title={title} subtitle={subtitle} />
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-line bg-surface-warm px-6 py-3.5">
            {footer}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-[424px] max-w-[calc(100vw-48px)] gap-0 border-l border-line bg-popover p-0 shadow-[-24px_0_60px_rgba(16,24,40,0.12)] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
      >
        <SheetHeaderBlock title={title} subtitle={subtitle} />
        <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-line bg-surface-warm px-5 py-3">{footer}</div>}
      </SheetContent>
    </Sheet>
  );
}

export function ScoreRing({
  value,
  size = 74,
  stroke = 7,
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
}) {
  const reduceMotion = useReducedMotion();
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(1, Math.max(0, value / 100)));
  const color = value >= 80 ? '#3FB68B' : value >= 60 ? '#E5A23C' : '#E5645C';
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#ECE9E0" strokeWidth={stroke} fill="none" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          initial={false}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: reduceMotion ? 0 : 0.6, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[17px] font-semibold leading-none tabular-nums" style={{ color }}>
          {Math.round(value)}
          <span className="text-[10px] font-medium">%</span>
        </span>
        {label && <span className="mt-0.5 text-[9px] text-muted-foreground">{label}</span>}
      </div>
    </div>
  );
}
