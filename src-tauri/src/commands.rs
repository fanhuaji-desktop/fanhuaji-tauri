use fanhuaji_core::{Backups, ConvertFileResult, ConvertParams, PreviewResult, ServiceInfo};
use tauri::{Emitter, Manager};
use tauri_plugin_dialog::DialogExt;

/// The shared HTTP client, held as Tauri managed state.
pub struct HttpClient(reqwest::Client);

#[tauri::command]
pub async fn get_service_info(client: tauri::State<'_, HttpClient>) -> Result<ServiceInfo, String> {
    fanhuaji_core::fetch_service_info(&client.0).await
}

#[tauri::command]
pub async fn pick_save_folder(
    app: tauri::AppHandle,
    title: String,
) -> Result<Option<String>, String> {
    let path = app.dialog().file().set_title(title).blocking_pick_folder();

    Ok(path.map(|p| p.to_string()))
}

/// Dialog strings come from the frontend so they follow the UI language.
#[tauri::command]
pub async fn open_files_dialog(
    app: tauri::AppHandle,
    title: String,
    supported_label: String,
    all_label: String,
) -> Result<Vec<String>, String> {
    let paths = app
        .dialog()
        .file()
        .add_filter(
            supported_label,
            &[
                "txt", "srt", "ass", "ssa", "lrc", "vtt", "sub", "csv", "tsv", "json", "xml",
                "html", "htm", "md", "epub",
            ],
        )
        .add_filter(all_label, &["*"])
        .set_title(title)
        .blocking_pick_files();

    match paths {
        Some(files) => Ok(files.iter().map(|f| f.to_string()).collect()),
        None => Ok(vec![]),
    }
}

#[tauri::command]
pub async fn convert_file(
    app: tauri::AppHandle,
    client: tauri::State<'_, HttpClient>,
    backups: tauri::State<'_, Backups>,
    params: ConvertParams,
) -> Result<ConvertFileResult, String> {
    fanhuaji_core::convert_file(&client.0, &backups, &params, |p| {
        let _ = app.emit("epub-progress", p);
    })
    .await
}

#[tauri::command]
pub async fn preview_convert(
    client: tauri::State<'_, HttpClient>,
    params: ConvertParams,
) -> Result<PreviewResult, String> {
    fanhuaji_core::preview_convert(&client.0, &params).await
}

#[tauri::command]
pub async fn convert_epub(
    app: tauri::AppHandle,
    client: tauri::State<'_, HttpClient>,
    backups: tauri::State<'_, Backups>,
    params: ConvertParams,
) -> Result<ConvertFileResult, String> {
    fanhuaji_core::convert_epub(&client.0, &backups, &params, |p| {
        let _ = app.emit("epub-progress", p);
    })
    .await
}

/// Put back the original that overwrite mode replaced for `file_id`.
#[tauri::command]
pub async fn restore_backup(
    backups: tauri::State<'_, Backups>,
    file_id: String,
) -> Result<(), String> {
    backups.restore(&file_id)
}

/// Returns `true` when this build is the Windows portable distribution, which
/// is detected by a `portable` marker file shipped next to the executable.
/// Portable builds cannot self-update in place (the Tauri Windows updater only
/// runs an installer), so the frontend uses this to switch to a notify-only flow.
#[tauri::command]
pub fn is_portable() -> bool {
    std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(|dir| dir.join("portable").exists()))
        .unwrap_or(false)
}

pub fn run() {
    tauri::Builder::default()
        .manage(HttpClient(
            reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .expect("無法建立 HTTP 客戶端"),
        ))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;
            let backup_dir = app.path().app_cache_dir()?.join("backups");
            app.manage(Backups::new(backup_dir)?);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_service_info,
            pick_save_folder,
            open_files_dialog,
            convert_file,
            convert_epub,
            preview_convert,
            restore_backup,
            is_portable,
        ])
        .run(tauri::generate_context!())
        .expect("啟動應用程式時發生錯誤");
}
