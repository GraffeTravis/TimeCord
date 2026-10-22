fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "snapshot",
            "save_client",
            "save_project",
            "save_entry",
            "delete_entry",
            "start_timer",
            "stop_timer",
            "save_settings",
            "export_backup",
            "import_backup",
            "export_csv",
            "confirm_action",
        ]),
    ))
    .expect("Configuration des permissions Tauri invalide");
}
