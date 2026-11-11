import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useAppStore, type ToastMessage } from '../store/useAppStore';

const TONE_STYLE: Record<
  ToastMessage['tone'],
  { icon: typeof Info; color: string; bg: string; border: string }
> = {
  info: { icon: Info, color: '#3D5AFE', bg: '#F2F5FF', border: '#dfe6ff' },
  success: { icon: CheckCircle2, color: '#2F9C77', bg: '#F1FAF6', border: '#d4efe3' },
  warn: { icon: AlertTriangle, color: '#C98A24', bg: '#FFFAF0', border: '#f3e2c4' },
  danger: { icon: XCircle, color: '#D25048', bg: '#FFF5F4', border: '#f6d7d4' },
};

export function Toasts() {
  const toasts = useAppStore((s) => s.toasts);
  const dismissToast = useAppStore((s) => s.dismissToast);

  return (
    <div className="pointer-events-none fixed bottom-11 left-1/2 z-[70] flex w-[min(420px,calc(100vw-32px))] -translate-x-1/2 flex-col items-center gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const tone = TONE_STYLE[toast.tone];
          const Icon = tone.icon;
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 14, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              className="pointer-events-auto flex w-full items-center gap-2.5 rounded-[12px] border px-3.5 py-2.5 shadow-[0_14px_36px_rgba(16,24,40,0.16)] backdrop-blur"
              style={{ background: 'rgba(255,255,255,0.94)', borderColor: tone.border }}
            >
              <span
                className="grid h-6 w-6 shrink-0 place-items-center rounded-[7px]"
                style={{ background: tone.bg, color: tone.color }}
              >
                <Icon size={14} />
              </span>
              <span className="min-w-0 flex-1 text-[12px] leading-snug text-ink">{toast.text}</span>
              <button
                className="icon-btn h-6 w-6 shrink-0"
                onClick={() => dismissToast(toast.id)}
                aria-label="关闭提示"
              >
                <X size={12} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
