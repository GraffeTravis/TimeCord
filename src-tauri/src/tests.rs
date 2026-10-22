use super::{
    models::*,
    store::{Action, Store},
};
use std::{fs, time::Duration};
use tempfile::tempdir;
use uuid::Uuid;
fn project() -> Project {
    Project {
        id: Uuid::new_v4().to_string(),
        name: "Projet de test".into(),
        color: "#7760ce".into(),
        client_id: None,
        archived: false,
    }
}
fn entry(project: &Project, start: &str, end: &str) -> Entry {
    Entry {
        id: Uuid::new_v4().to_string(),
        description: "Travail de nuit".into(),
        project_id: project.id.clone(),
        client_id: None,
        start: start.into(),
        end: end.into(),
    }
}
fn setup() -> (tempfile::TempDir, Store, Project) {
    let directory = tempdir().unwrap();
    let mut store = Store::open(directory.path()).unwrap();
    let p = project();
    store.mutate(Action::Project(p.clone())).unwrap();
    (directory, store, p)
}
#[test]
fn migrations_and_reopen_preserve_data() {
    let (directory, mut store, project) = setup();
    let state = store
        .mutate(Action::Entry(entry(
            &project,
            "2026-01-06T09:00:00Z",
            "2026-01-06T12:00:00Z",
        )))
        .unwrap();
    drop(store);
    let reopened = Store::open(directory.path()).unwrap();
    assert_eq!(reopened.snapshot().unwrap(), state);
}
#[test]
fn overlapping_offsets_are_rejected_without_data_loss() {
    let (_directory, mut store, project) = setup();
    let state = store
        .mutate(Action::Entry(entry(
            &project,
            "2026-01-06T09:00:00Z",
            "2026-01-06T12:00:00Z",
        )))
        .unwrap();
    assert!(
        store
            .mutate(Action::Entry(entry(
                &project,
                "2026-01-05T23:30:00-10:00",
                "2026-01-06T00:30:00-10:00"
            )))
            .unwrap_err()
            .contains("chevauche")
    );
    assert_eq!(store.snapshot().unwrap(), state);
    assert!(
        store
            .mutate(Action::Entry(entry(
                &project,
                "2026-01-06T12:00:00Z",
                "2026-01-06T13:00:00Z"
            )))
            .is_ok()
    );
}
#[test]
fn timer_survives_reopen_and_second_start_is_rejected() {
    let (directory, mut store, project) = setup();
    let start = StartTimer {
        description: "Minuteur".into(),
        project_id: project.id.clone(),
        client_id: None,
    };
    let state = store.mutate(Action::Start(start.clone())).unwrap();
    assert!(store.mutate(Action::Start(start)).is_err());
    drop(store);
    let mut store = Store::open(directory.path()).unwrap();
    assert_eq!(store.snapshot().unwrap(), state);
    std::thread::sleep(Duration::from_millis(3));
    let ended = store.mutate(Action::Stop).unwrap();
    assert!(ended.timer.is_none());
    assert_eq!(ended.entries.len(), 1);
    assert_eq!(ended.entries[0].start, state.timer.unwrap().start);
}
#[test]
fn timer_cannot_be_archived_or_overlapped() {
    let (_directory, mut store, mut project) = setup();
    store
        .mutate(Action::Start(StartTimer {
            description: "Tâche".into(),
            project_id: project.id.clone(),
            client_id: None,
        }))
        .unwrap();
    project.archived = true;
    assert!(store.mutate(Action::Project(project.clone())).is_err());
    assert!(
        store
            .mutate(Action::Entry(entry(
                &project,
                "2090-01-01T10:00:00Z",
                "2090-01-01T12:00:00Z"
            )))
            .is_err()
    );
}
#[test]
fn invalid_backup_is_refused_and_valid_backup_creates_recovery_copy() {
    let (directory, mut store, project) = setup();
    let initial = store.snapshot().unwrap();
    let with_entry = store
        .mutate(Action::Entry(entry(
            &project,
            "2026-01-06T09:00:00Z",
            "2026-01-06T12:00:00Z",
        )))
        .unwrap();
    let mut bad = Backup::new(initial.clone());
    bad.data.projects.clear();
    bad.data.entries = with_entry.entries.clone();
    assert!(store.restore(bad).is_err());
    assert_eq!(store.snapshot().unwrap(), with_entry);
    let restored = store.restore(Backup::new(initial.clone())).unwrap();
    assert_eq!(restored, initial);
    let files = fs::read_dir(directory.path().join("backups"))
        .unwrap()
        .collect::<std::io::Result<Vec<_>>>()
        .unwrap();
    assert_eq!(files.len(), 1);
    let saved = Backup::parse(&fs::read(files[0].path()).unwrap()).unwrap();
    assert_eq!(saved.data, with_entry);
}
#[test]
fn failed_write_rolls_back_timer_stop_and_restore() {
    let (directory, mut store, project) = setup();
    store
        .mutate(Action::Start(StartTimer {
            description: "Tâche".into(),
            project_id: project.id.clone(),
            client_id: None,
        }))
        .unwrap();
    let before = store.snapshot().unwrap();
    let conn = rusqlite::Connection::open(directory.path().join("timecord.sqlite")).unwrap();
    conn.execute_batch("CREATE TRIGGER fail_insert BEFORE INSERT ON entries BEGIN SELECT RAISE(FAIL,'test failure'); END;").unwrap();
    std::thread::sleep(Duration::from_millis(3));
    assert!(store.mutate(Action::Stop).is_err());
    assert_eq!(store.snapshot().unwrap(), before);
    let mut backup = Backup::new(before.clone());
    backup.data.timer = None;
    backup.data.entries.push(entry(
        &project,
        "2026-01-06T09:00:00Z",
        "2026-01-06T12:00:00Z",
    ));
    assert!(store.restore(backup).is_err());
    assert_eq!(store.snapshot().unwrap(), before);
}
#[test]
fn legacy_web_backup_round_trip_preserves_identifiers_and_instants() {
    let (_directory, mut store, project) = setup();
    let mut backup = Backup::new(store.snapshot().unwrap());
    backup.data.entries.push(entry(
        &project,
        "2026-01-05T23:00:00-10:00",
        "2026-01-06T02:00:00-10:00",
    ));
    let json = serde_json::to_vec(&backup).unwrap();
    let parsed = Backup::parse(&json).unwrap();
    assert_eq!(parsed.data.entries[0].start, "2026-01-06T09:00:00.000Z");
    let restored = store.restore(parsed).unwrap();
    assert_eq!(restored.entries[0].id, backup.data.entries[0].id);
}
#[test]
fn corrupt_dates_preferences_and_references_are_refused() {
    let (_directory, mut store, project) = setup();
    assert!(
        store
            .mutate(Action::Entry(entry(
                &project,
                "2026-01-06T12:00:00Z",
                "2026-01-06T09:00:00Z"
            )))
            .is_err()
    );
    assert!(
        store
            .mutate(Action::Settings(Settings {
                timezone: "Bad/Zone".into(),
                weekly_goal: 35.0
            }))
            .is_err()
    );
    let mut missing = entry(&project, "2026-01-06T09:00:00Z", "2026-01-06T12:00:00Z");
    missing.project_id = Uuid::new_v4().to_string();
    assert!(store.mutate(Action::Entry(missing)).is_err());
    assert!(Backup::parse(b"{broken}").is_err());
    let mut backup = Backup::new(store.snapshot().unwrap());
    backup.version = 2;
    assert!(Backup::parse(&serde_json::to_vec(&backup).unwrap()).is_err());
}
#[test]
fn newer_database_is_never_downgraded() {
    let directory = tempdir().unwrap();
    let conn = rusqlite::Connection::open(directory.path().join("timecord.sqlite")).unwrap();
    conn.pragma_update(None, "user_version", 2).unwrap();
    drop(conn);
    assert!(Store::open(directory.path()).is_err());
    let conn = rusqlite::Connection::open(directory.path().join("timecord.sqlite")).unwrap();
    assert_eq!(
        conn.pragma_query_value(None, "user_version", |r| r.get::<_, u32>(0))
            .unwrap(),
        2
    );
}
#[test]
fn sql_text_is_parameterized_and_exports_keep_extensions() {
    let (directory, mut store, mut project) = setup();
    project.name = "'); DROP TABLE entries; --".into();
    store.mutate(Action::Project(project)).unwrap();
    assert!(store.snapshot().is_ok());
    assert!(super::write_export(&directory.path().join("report.exe"), b"test", "csv").is_err());
    let file = directory.path().join("report.csv");
    super::write_export(&file, b"first", "csv").unwrap();
    super::write_export(&file, b"second", "csv").unwrap();
    assert_eq!(fs::read(file).unwrap(), b"second");
}

#[test]
fn optional_client_references_and_archives_survive_backup() {
    let (directory, mut store, mut project) = setup();
    let mut client = Client {
        id: Uuid::new_v4().to_string(),
        name: "Client local".into(),
        archived: false,
    };
    store.mutate(Action::Client(client.clone())).unwrap();
    project.client_id = Some(client.id.clone());
    store.mutate(Action::Project(project.clone())).unwrap();
    let mut task = entry(&project, "2026-01-06T09:00:00Z", "2026-01-06T12:00:00Z");
    task.client_id = Some(client.id.clone());
    store.mutate(Action::Entry(task)).unwrap();
    store
        .mutate(Action::Start(StartTimer {
            description: "Tâche du client".into(),
            project_id: project.id.clone(),
            client_id: Some(client.id.clone()),
        }))
        .unwrap();
    client.archived = true;
    assert!(store.mutate(Action::Client(client.clone())).is_err());
    std::thread::sleep(Duration::from_millis(3));
    store.mutate(Action::Stop).unwrap();
    let state = store.mutate(Action::Client(client.clone())).unwrap();
    let bytes = serde_json::to_vec(&Backup::new(state.clone())).unwrap();
    store.restore(Backup::parse(&bytes).unwrap()).unwrap();
    drop(store);
    let restored = Store::open(directory.path()).unwrap().snapshot().unwrap();
    assert_eq!(restored, state);
    assert_eq!(restored.projects[0].client_id, Some(client.id.clone()));
    assert!(
        restored
            .entries
            .iter()
            .all(|e| e.client_id.as_ref() == Some(&client.id))
    );
    assert!(restored.clients[0].archived);
}
