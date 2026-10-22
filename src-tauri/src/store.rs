use crate::models::*;
use rusqlite::{Connection, OptionalExtension, TransactionBehavior, params};
use std::{
    fs::{self, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
    time::Duration,
};
use uuid::Uuid;
pub struct Store {
    conn: Connection,
    pub directory: PathBuf,
}
pub enum Action {
    Client(Client),
    Project(Project),
    Entry(Entry),
    DeleteEntry(String),
    Start(StartTimer),
    Stop,
    Settings(Settings),
}
fn sql(error: rusqlite::Error) -> String {
    eprintln!("SQLite: {error}");
    "Impossible d’enregistrer ou de lire les données locales.".into()
}
impl Store {
    pub fn open(directory: &Path) -> Result<Self> {
        fs::create_dir_all(directory).map_err(|_| "Impossible de créer le dossier de données.")?;
        let mut conn = Connection::open(directory.join("timecord.sqlite")).map_err(sql)?;
        conn.busy_timeout(Duration::from_secs(5)).map_err(sql)?;
        conn.pragma_update(None, "journal_mode", "WAL")
            .map_err(sql)?;
        conn.pragma_update(None, "foreign_keys", true)
            .map_err(sql)?;
        let tx = conn
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .map_err(sql)?;
        let version: u32 = tx
            .pragma_query_value(None, "user_version", |r| r.get(0))
            .map_err(sql)?;
        if version > 1 {
            return Err("Base plus récente que cette version de Timecord.".into());
        }
        if version == 0 {
            tx.execute_batch(include_str!("../migrations/001.sql"))
                .map_err(sql)?;
        }
        tx.commit().map_err(sql)?;
        Ok(Self {
            conn,
            directory: directory.into(),
        })
    }
    pub fn snapshot(&self) -> Result<Snapshot> {
        let clients = self
            .conn
            .prepare("SELECT id,name,archived FROM clients ORDER BY rowid")
            .map_err(sql)?
            .query_map([], |r| {
                Ok(Client {
                    id: r.get(0)?,
                    name: r.get(1)?,
                    archived: r.get(2)?,
                })
            })
            .map_err(sql)?
            .collect::<std::result::Result<Vec<_>, _>>()
            .map_err(sql)?;
        let projects = self
            .conn
            .prepare("SELECT id,name,color,clientId,archived FROM projects ORDER BY rowid")
            .map_err(sql)?
            .query_map([], |r| {
                Ok(Project {
                    id: r.get(0)?,
                    name: r.get(1)?,
                    color: r.get(2)?,
                    client_id: r.get(3)?,
                    archived: r.get(4)?,
                })
            })
            .map_err(sql)?
            .collect::<std::result::Result<Vec<_>, _>>()
            .map_err(sql)?;
        let entries = self
            .conn
            .prepare(
                "SELECT id,description,projectId,clientId,start,end FROM entries ORDER BY rowid",
            )
            .map_err(sql)?
            .query_map([], |r| {
                Ok(Entry {
                    id: r.get(0)?,
                    description: r.get(1)?,
                    project_id: r.get(2)?,
                    client_id: r.get(3)?,
                    start: r.get(4)?,
                    end: r.get(5)?,
                })
            })
            .map_err(sql)?
            .collect::<std::result::Result<Vec<_>, _>>()
            .map_err(sql)?;
        let timer = self
            .conn
            .query_row(
                "SELECT description,projectId,clientId,start FROM timer WHERE id=1",
                [],
                |r| {
                    Ok(Timer {
                        description: r.get(0)?,
                        project_id: r.get(1)?,
                        client_id: r.get(2)?,
                        start: r.get(3)?,
                    })
                },
            )
            .optional()
            .map_err(sql)?;
        let settings = self
            .conn
            .query_row(
                "SELECT timezone,weeklyGoal FROM settings WHERE id=1",
                [],
                |r| {
                    Ok(Settings {
                        timezone: r.get(0)?,
                        weekly_goal: r.get(1)?,
                    })
                },
            )
            .map_err(sql)?;
        Ok(Snapshot {
            clients,
            projects,
            entries,
            timer,
            settings,
        })
    }
    pub fn mutate(&mut self, action: Action) -> Result<Snapshot> {
        let mut data = self.snapshot()?;
        match &action {
            Action::Client(c) => {
                if c.archived
                    && data
                        .timer
                        .as_ref()
                        .is_some_and(|t| t.client_id.as_ref() == Some(&c.id))
                {
                    return Err("Arrêtez le chronomètre avant d’archiver ce client.".into());
                }
                if let Some(old) = data.clients.iter_mut().find(|v| v.id == c.id) {
                    *old = c.clone();
                } else {
                    data.clients.push(c.clone());
                }
            }
            Action::Project(p) => {
                if p.archived && data.timer.as_ref().is_some_and(|t| t.project_id == p.id) {
                    return Err("Arrêtez le chronomètre avant d’archiver ce projet.".into());
                }
                if let Some(old) = data.projects.iter_mut().find(|v| v.id == p.id) {
                    *old = p.clone();
                } else {
                    data.projects.push(p.clone());
                }
            }
            Action::Entry(e) => {
                let old = data.entries.iter().find(|v| v.id == e.id);
                let unchanged =
                    old.is_some_and(|o| o.project_id == e.project_id && o.client_id == e.client_id);
                active_references(&data, &e.project_id, &e.client_id, unchanged)?;
                if let Some(old) = data.entries.iter_mut().find(|v| v.id == e.id) {
                    *old = e.clone();
                } else {
                    data.entries.push(e.clone());
                }
            }
            Action::DeleteEntry(value) => {
                id(value)?;
                data.entries.retain(|e| &e.id != value);
            }
            Action::Start(input) => {
                if data.timer.is_some() {
                    return Err("Un chronomètre est déjà actif.".into());
                }
                active_references(&data, &input.project_id, &input.client_id, false)?;
                data.timer = Some(Timer {
                    description: input.description.clone(),
                    project_id: input.project_id.clone(),
                    client_id: input.client_id.clone(),
                    start: now(),
                });
            }
            Action::Stop => {
                let timer = data.timer.take().ok_or("Aucun chronomètre actif.")?;
                data.entries.push(Entry {
                    id: Uuid::new_v4().to_string(),
                    description: timer.description,
                    project_id: timer.project_id,
                    client_id: timer.client_id,
                    start: timer.start,
                    end: now(),
                });
            }
            Action::Settings(settings) => data.settings = settings.clone(),
        }
        normalize(&mut data)?;
        let tx = self
            .conn
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .map_err(sql)?;
        match &action {
            Action::Client(input) => {
                save_client(&tx, data.clients.iter().find(|v| v.id == input.id).unwrap())?
            }
            Action::Project(input) => save_project(
                &tx,
                data.projects.iter().find(|v| v.id == input.id).unwrap(),
            )?,
            Action::Entry(input) => {
                save_entry(&tx, data.entries.iter().find(|v| v.id == input.id).unwrap())?
            }
            Action::DeleteEntry(value) => {
                tx.execute("DELETE FROM entries WHERE id=?1", [value])
                    .map_err(sql)?;
            }
            Action::Start(_) => save_timer(&tx, data.timer.as_ref().unwrap())?,
            Action::Stop => {
                tx.execute("DELETE FROM timer", []).map_err(sql)?;
                save_entry(&tx, data.entries.last().unwrap())?;
            }
            Action::Settings(_) => save_settings(&tx, &data.settings)?,
        }
        tx.commit().map_err(sql)?;
        Ok(data)
    }
    pub fn restore(&mut self, mut backup: Backup) -> Result<Snapshot> {
        if backup.format != "timecord" || backup.version != 1 {
            return Err("Format ou version de sauvegarde non pris en charge.".into());
        }
        normalize(&mut backup.data)?;
        let previous = serde_json::to_vec_pretty(&Backup::new(self.snapshot()?))
            .map_err(|_| "Sauvegarde impossible.")?;
        let directory = self.directory.join("backups");
        fs::create_dir_all(&directory).map_err(|_| "Impossible de créer la copie de sécurité.")?;
        write_new(
            &directory.join(format!("avant-restauration-{}.json", Uuid::new_v4())),
            &previous,
        )?;
        let tx = self
            .conn
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .map_err(sql)?;
        tx.execute_batch(
            "DELETE FROM timer; DELETE FROM entries; DELETE FROM projects; DELETE FROM clients;",
        )
        .map_err(sql)?;
        for c in &backup.data.clients {
            save_client(&tx, c)?;
        }
        for p in &backup.data.projects {
            save_project(&tx, p)?;
        }
        for e in &backup.data.entries {
            save_entry(&tx, e)?;
        }
        if let Some(timer) = &backup.data.timer {
            save_timer(&tx, timer)?;
        }
        save_settings(&tx, &backup.data.settings)?;
        tx.commit().map_err(sql)?;
        Ok(backup.data)
    }
}
pub fn write_new(path: &Path, bytes: &[u8]) -> Result<()> {
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .map_err(|_| "Impossible de créer le fichier de sauvegarde.")?;
    file.write_all(bytes)
        .and_then(|_| file.sync_all())
        .map_err(|_| "Écriture du fichier impossible.".to_string())
}
fn active_references(
    data: &Snapshot,
    project: &str,
    client: &Option<String>,
    allow_archived: bool,
) -> Result<()> {
    if !data
        .projects
        .iter()
        .any(|p| p.id == project && (allow_archived || !p.archived))
    {
        return Err("Choisis un projet actif.".into());
    }
    if client.as_ref().is_some_and(|id| {
        !data
            .clients
            .iter()
            .any(|c| &c.id == id && (allow_archived || !c.archived))
    }) {
        return Err("Choisis un client actif.".into());
    }
    Ok(())
}
fn save_client(c: &Connection, v: &Client) -> Result<()> {
    c.execute("INSERT INTO clients(id,name,archived) VALUES (?1,?2,?3) ON CONFLICT(id) DO UPDATE SET name=excluded.name,archived=excluded.archived", params![v.id,v.name,v.archived]).map_err(sql)?;
    Ok(())
}
fn save_project(c: &Connection, v: &Project) -> Result<()> {
    c.execute("INSERT INTO projects(id,name,color,clientId,archived) VALUES (?1,?2,?3,?4,?5) ON CONFLICT(id) DO UPDATE SET name=excluded.name,color=excluded.color,clientId=excluded.clientId,archived=excluded.archived", params![v.id,v.name,v.color,v.client_id,v.archived]).map_err(sql)?;
    Ok(())
}
fn save_entry(c: &Connection, v: &Entry) -> Result<()> {
    c.execute("INSERT INTO entries(id,description,projectId,clientId,start,end) VALUES (?1,?2,?3,?4,?5,?6) ON CONFLICT(id) DO UPDATE SET description=excluded.description,projectId=excluded.projectId,clientId=excluded.clientId,start=excluded.start,end=excluded.end", params![v.id,v.description,v.project_id,v.client_id,v.start,v.end]).map_err(sql)?;
    Ok(())
}
fn save_timer(c: &Connection, v: &Timer) -> Result<()> {
    c.execute(
        "INSERT INTO timer(id,description,projectId,clientId,start) VALUES (1,?1,?2,?3,?4)",
        params![v.description, v.project_id, v.client_id, v.start],
    )
    .map_err(sql)?;
    Ok(())
}
fn save_settings(c: &Connection, v: &Settings) -> Result<()> {
    c.execute(
        "UPDATE settings SET timezone=?1,weeklyGoal=?2 WHERE id=1",
        params![v.timezone, v.weekly_goal],
    )
    .map_err(sql)?;
    Ok(())
}
