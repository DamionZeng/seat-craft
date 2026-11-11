import { useState } from 'react';
import {
  BrainCircuit,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff,
  Info,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { Field, Modal, Switch } from './ui';
import { localRepository } from '../lib/repository';

export function SettingsDialog() {
  const open = useAppStore((s) => s.settingsOpen);
  const setOpen = useAppStore((s) => s.setSettingsOpen);
  const aiSettings = useAppStore((s) => s.aiSettings);
  const setAiSettings = useAppStore((s) => s.setAiSettings);
  const applyAi = useAppStore((s) => s.applyAiSemantics);
  const aiBusy = useAppStore((s) => s.aiBusy);
  const aiError = useAppStore((s) => s.aiError);
  const semanticMode = useAppStore((s) => s.semanticMode);
  const resetDemo = useAppStore((s) => s.resetDemo);
  const notify = useAppStore((s) => s.notify);

  const [showKey, setShowKey] = useState(false);

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      title="设置"
      subtitle="AI 语义服务、隐私与本地数据"
      width={620}
      footer={
        <button className="btn btn-soft" onClick={() => setOpen(false)}>
          完成
        </button>
      }
    >
      <div className="flex flex-col gap-5">
        <section>
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <BrainCircuit size={14} className="text-muted-foreground" />
              <h3 className="text-[12.5px] font-semibold">特点语义引擎</h3>
            </div>
            <span
              className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                semanticMode === 'ai'
                  ? 'bg-ok-soft text-[#2c8463]'
                  : 'bg-warn-soft text-[#a9761f]'
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {semanticMode === 'ai' ? 'AI 语义模式' : '本地语义模式'}
            </span>
          </div>

          <div className="rounded-[14px] border border-line bg-white px-4 py-3.5">
            <div className="flex items-start gap-2 rounded-[10px] bg-primary-soft px-3 py-2 text-[10.5px] leading-relaxed text-[#4453a8]">
              <Info size={13} className="mt-0.5 shrink-0" />
              AI 只做「把自由文本翻译成标签」，不参与座位生成。未配置 Key、断网或超时都会自动回退到本地同义词词典，排座功能不受影响。
            </div>

            <div className="mt-3 flex flex-col gap-3">
              <Field
                label="硅基流动 API Key"
                hint="仅保存在本机（桌面版将加密存储于系统凭据），不会随名单上传。"
              >
                <div className="relative">
                  <input
                    className="input pr-9"
                    type={showKey ? 'text' : 'password'}
                    value={aiSettings.apiKey}
                    placeholder="sk-..."
                    onChange={(e) => setAiSettings({ apiKey: e.target.value.trim() })}
                  />
                  <button
                    type="button"
                    className="absolute right-1 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-[#f3f1ea]"
                    onClick={() => setShowKey((v) => !v)}
                    aria-label={showKey ? '隐藏 Key' : '显示 Key'}
                  >
                    {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </Field>

              <div className="grid grid-cols-2 gap-2.5">
                <Field label="标签抽取模型">
                  <input
                    className="input text-[11.5px]"
                    value={aiSettings.chatModel}
                    onChange={(e) => setAiSettings({ chatModel: e.target.value })}
                  />
                </Field>
                <Field label="向量模型">
                  <input
                    className="input text-[11.5px]"
                    value={aiSettings.embeddingModel}
                    onChange={(e) => setAiSettings({ embeddingModel: e.target.value })}
                  />
                </Field>
              </div>

              <div className="flex items-center justify-between rounded-[10px] bg-surface-warm px-3 py-2.5">
                <div>
                  <div className="flex items-center gap-1.5 text-[11.5px] font-medium">
                    <ShieldCheck size={13} className="text-ok" />
                    严格脱敏
                  </div>
                  <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">
                    上传前把特点文本中的学生姓名替换为「某同学」，只上传特点文本。
                  </p>
                </div>
                <Switch
                  checked={aiSettings.strictMask}
                  onChange={(strictMask) => setAiSettings({ strictMask })}
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <a
                  className="flex items-center gap-1 text-[10.5px] text-primary hover:underline"
                  href="https://cloud.siliconflow.cn"
                  target="_blank"
                  rel="noreferrer"
                >
                  获取 API Key <ExternalLink size={10} />
                </a>
                <button
                  className="btn btn-primary h-8 text-[11.5px]"
                  onClick={() => void applyAi()}
                  disabled={aiBusy || !aiSettings.apiKey}
                  style={{ opacity: aiBusy || !aiSettings.apiKey ? 0.55 : 1 }}
                >
                  {aiBusy ? (
                    <>
                      <Loader2 size={12} className="animate-spin" /> 正在分析…
                    </>
                  ) : (
                    <>
                      <Sparkles size={12} /> 测试连通并增强语义
                    </>
                  )}
                </button>
              </div>

              {aiError && (
                <div className="flex items-start gap-1.5 rounded-[9px] bg-danger-soft px-2.5 py-2 text-[10.5px] text-[#b34a43]">
                  <TriangleAlert size={12} className="mt-0.5 shrink-0" />
                  {aiError}。已自动使用本地语义模式。
                </div>
              )}

              {semanticMode === 'ai' && !aiError && (
                <div className="flex items-center gap-1.5 text-[10.5px] text-ok">
                  <CheckCircle2 size={12} /> 已启用 AI 语义，标签与语义簇已更新
                </div>
              )}
            </div>
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-[12.5px] font-semibold">本地数据</h3>
          <div className="rounded-[14px] border border-line bg-white px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11.5px] font-medium">重新载入示例班级</div>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  清空当前编辑，恢复 40 人示例名单与默认布局。
                </p>
              </div>
              <button
                className="btn btn-soft h-8 shrink-0 text-[11px]"
                onClick={() => {
                  if (window.confirm('将清空当前排座与名单，恢复示例数据，确定继续？')) {
                    resetDemo();
                    notify('已恢复示例班级', 'success');
                  }
                }}
              >
                <RotateCcw size={12} /> 恢复示例
              </button>
            </div>
            <div className="my-2.5 h-px bg-line" />
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11.5px] font-medium">清空本地缓存</div>
                <p className="mt-0.5 text-[10px] text-muted-foreground">
                  删除浏览器中保存的班级、名单与方案（桌面版对应 SQLite）。
                </p>
              </div>
              <button
                className="btn btn-danger h-8 shrink-0 text-[11px]"
                onClick={() => {
                  if (window.confirm('确定清空本地缓存？此操作不可撤销。')) {
                    localRepository.clear();
                    window.location.reload();
                  }
                }}
              >
                清空缓存
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-[14px] border border-line bg-surface-warm px-4 py-3 text-[10.5px] leading-relaxed text-muted-foreground">
          <div className="mb-1 text-[11.5px] font-semibold text-ink">关于排座台</div>
          确定性排座引擎（贪心 + 模拟退火，硬约束 100%） · 语义层由硅基流动提供 ·
          Web 预览版数据存储于 localStorage，桌面端使用 Tauri 2 + SQLite，API Key 由
          Rust 进程持有。
        </section>
      </div>
    </Modal>
  );
}
