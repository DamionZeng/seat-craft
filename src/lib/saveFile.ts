type SaveKind = 'png' | 'pdf';

/** 是否运行在 Tauri 桌面壳里 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * 桌面端弹出系统保存对话框并写盘，浏览器里回退成 a[download]。
 * 用户取消时静默返回。
 */
export async function saveExportFile(
  filename: string,
  dataUrl: string,
  kind: SaveKind,
): Promise<void> {
  if (!isTauri()) {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    link.click();
    return;
  }

  const [{ save }, { invoke }] = await Promise.all([
    import('@tauri-apps/plugin-dialog'),
    import('@tauri-apps/api/core'),
  ]);
  const path = await save({
    defaultPath: filename,
    filters: [{ name: kind === 'png' ? 'PNG 图片' : 'PDF 文档', extensions: [kind] }],
  });
  if (!path) return;
  await invoke('save_bytes', { path, data: Array.from(dataUrlToBytes(dataUrl)) });
}
