// 桌面端入口：屏蔽 Windows 控制台窗口，注册导出保存命令
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

/// 把前端生成的 PNG/PDF 字节写入用户选择的路径
#[tauri::command]
fn save_bytes(path: String, data: Vec<u8>) -> Result<(), String> {
    std::fs::write(path, data).map_err(|error| error.to_string())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![save_bytes])
        .run(tauri::generate_context!())
        .expect("启动桌面应用失败");
}
