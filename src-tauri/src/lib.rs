mod models;
mod store;
#[cfg(test)]
mod tests;
use models::*;
use std::{
    fs,
    io::Read,
    path::Path,
    sync::{Arc, Mutex},
};
use store::{Action, Store};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};

#[derive(Clone)]
struct AppState(Arc<Mutex<Store>>);
async fn task<T: Send + 'static>(work: impl FnOnce() -> Result<T> + Send + 'static) -> Result<T> {
    tauri::async_runtime::spawn_blocking(work)
        .await
        .map_err(|_| "L’opération locale a été interrompue.")?
}
async fn apply(state: AppState, action: Action) -> Result<Snapshot> {
    task(move || {
        state
            .0
            .lock()
            .map_err(|_| "Base de données indisponible.")?
            .mutate(action)
    })
    .await
}
#[tauri::command]
async fn snapshot(state: State<'_, AppState>) -> Result<Snapshot> {
    let state = state.inner().clone();
    task(move || {
        state
            .0
            .lock()
            .map_err(|_| "Base de données indisponible.")?
            .snapshot()
    })
    .await
}
#[tauri::command]
async fn save_client(state: State<'_, AppState>, payload: Client) -> Result<Snapshot> {
    apply(state.inner().clone(), Action::Client(payload)).await
}
#[tauri::command]
async fn save_project(state: State<'_, AppState>, payload: Project) -> Result<Snapshot> {
    apply(state.inner().clone(), Action::Project(payload)).await
}
#[tauri::command]
async fn save_entry(state: State<'_, AppState>, payload: Entry) -> Result<Snapshot> {
    apply(state.inner().clone(), Action::Entry(payload)).await
}
#[tauri::command]
async fn delete_entry(state: State<'_, AppState>, payload: String) -> Result<Snapshot> {
    apply(state.inner().clone(), Action::DeleteEntry(payload)).await
}
#[tauri::command]
async fn start_timer(state: State<'_, AppState>, payload: StartTimer) -> Result<Snapshot> {
    apply(state.inner().clone(), Action::Start(payload)).await
}
#[tauri::command]
async fn stop_timer(state: State<'_, AppState>) -> Result<Snapshot> {
    apply(state.inner().clone(), Action::Stop).await
}
#[tauri::command]
async fn save_settings(state: State<'_, AppState>, payload: Settings) -> Result<Snapshot> {
    apply(state.inner().clone(), Action::Settings(payload)).await
}

fn ask(app: &AppHandle, message: &str) -> bool {
    let Some(window) = app.get_webview_window("main") else {
        return false;
    };
    app.dialog()
        .message(message)
        .parent(&window)
        .title("Timecord")
        .kind(MessageDialogKind::Warning)
        .buttons(MessageDialogButtons::OkCancelCustom(
            "Confirmer".into(),
            "Annuler".into(),
        ))
        .blocking_show()
}
fn file_dialog(app: &AppHandle) -> Result<tauri_plugin_dialog::FileDialogBuilder<tauri::Wry>> {
    let window = app
        .get_webview_window("main")
        .ok_or("Fenêtre principale indisponible.")?;
    Ok(app.dialog().file().set_parent(&window))
}
#[tauri::command]
async fn confirm_action(app: AppHandle, message: String) -> Result<bool> {
    if message.len() > 2000 {
        return Err("Message trop long.".into());
    }
    task(move || Ok(ask(&app, &message))).await
}
fn write_export(path: &Path, bytes: &[u8], extension: &str) -> Result<()> {
    if !path
        .extension()
        .is_some_and(|e| e.to_string_lossy().eq_ignore_ascii_case(extension))
    {
        return Err(format!("Le fichier doit porter l’extension .{extension}."));
    }
    let parent = path.parent().ok_or("Dossier de destination invalide.")?;
    let temporary = parent.join(format!(".timecord-{}.tmp", uuid::Uuid::new_v4()));
    store::write_new(&temporary, bytes)?;
    if fs::rename(&temporary, path).is_err() {
        let _ = fs::remove_file(&temporary);
        return Err("Impossible de remplacer le fichier de destination.".into());
    }
    Ok(())
}
#[tauri::command]
async fn export_backup(app: AppHandle, state: State<'_, AppState>) -> Result<bool> {
    let state = state.inner().clone();
    task(move || {
        let Some(path) = file_dialog(&app)?
            .add_filter("Sauvegarde Timecord", &["json"])
            .set_file_name("timecord-sauvegarde.json")
            .blocking_save_file()
        else {
            return Ok(false);
        };
        let path = path
            .into_path()
            .map_err(|_| "Chemin de fichier invalide.")?;
        let data = state
            .0
            .lock()
            .map_err(|_| "Base de données indisponible.")?
            .snapshot()?;
        let bytes =
            serde_json::to_vec_pretty(&Backup::new(data)).map_err(|_| "Sauvegarde impossible.")?;
        if bytes.len() as u64 > MAX_BYTES {
            return Err("Sauvegarde trop volumineuse (25 Mo maximum).".into());
        }
        write_export(&path, &bytes, "json")?;
        Ok(true)
    })
    .await
}
#[tauri::command]
async fn import_backup(app: AppHandle, state: State<'_, AppState>) -> Result<Option<Snapshot>> {
    let state = state.inner().clone();
    task(move || {
        let Some(path) = file_dialog(&app)?.add_filter("Sauvegarde Timecord", &["json"]).blocking_pick_file() else { return Ok(None); };
        let path = path.into_path().map_err(|_| "Chemin de fichier invalide.")?;
        let file = fs::File::open(path).map_err(|_| "Impossible d’ouvrir la sauvegarde.")?;
        let mut bytes = Vec::new(); file.take(MAX_BYTES + 1).read_to_end(&mut bytes).map_err(|_| "Lecture de la sauvegarde impossible.")?;
        let backup = Backup::parse(&bytes)?;
        if !ask(&app, "Remplacer toutes les données actuelles par cette sauvegarde ? Une copie de sécurité sera conservée dans le dossier de données de Timecord.") { return Ok(None); }
        Ok(Some(state.0.lock().map_err(|_| "Base de données indisponible.")?.restore(backup)?))
    }).await
}
#[tauri::command]
async fn export_csv(app: AppHandle, content: String) -> Result<bool> {
    if content.len() as u64 > MAX_BYTES {
        return Err("Export trop volumineux (25 Mo maximum).".into());
    }
    task(move || {
        let Some(path) = file_dialog(&app)?
            .add_filter("Rapport CSV", &["csv"])
            .set_file_name("timecord-rapport.csv")
            .blocking_save_file()
        else {
            return Ok(false);
        };
        write_export(
            &path
                .into_path()
                .map_err(|_| "Chemin de fichier invalide.")?,
            content.as_bytes(),
            "csv",
        )?;
        Ok(true)
    })
    .await
}
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let directory = app.path().app_local_data_dir()?;
            let store = Store::open(&directory).map_err(std::io::Error::other)?;
            app.manage(AppState(Arc::new(Mutex::new(store))));
            tauri::WebviewWindowBuilder::from_config(app, &app.config().app.windows[0])?
                .icon(
                    app.default_window_icon()
                        .cloned()
                        .ok_or_else(|| std::io::Error::other("Icône de fenêtre introuvable"))?,
                )?
                .on_navigation(|url| {
                    (url.scheme() == "tauri" && url.host_str() == Some("localhost"))
                        || (["http", "https"].contains(&url.scheme())
                            && url.host_str() == Some("tauri.localhost"))
                        || (cfg!(debug_assertions)
                            && url.scheme() == "http"
                            && url.host_str() == Some("127.0.0.1")
                            && url.port() == Some(3000))
                })
                .on_new_window(|_, _| tauri::webview::NewWindowResponse::Deny)
                .build()?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            snapshot,
            save_client,
            save_project,
            save_entry,
            delete_entry,
            start_timer,
            stop_timer,
            save_settings,
            export_backup,
            import_backup,
            export_csv,
            confirm_action
        ])
        .run(tauri::generate_context!())
        .expect("Impossible de démarrer Timecord");
}
