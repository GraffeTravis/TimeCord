use chrono::{DateTime, Datelike, SecondsFormat, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use uuid::Uuid;
pub const MAX_BYTES: u64 = 25 * 1024 * 1024;
pub type Result<T> = std::result::Result<T, String>;
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Client {
    pub id: String,
    pub name: String,
    pub archived: bool,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub color: String,
    pub client_id: Option<String>,
    pub archived: bool,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Entry {
    pub id: String,
    pub description: String,
    pub project_id: String,
    pub client_id: Option<String>,
    pub start: String,
    pub end: String,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Timer {
    pub description: String,
    pub project_id: String,
    pub client_id: Option<String>,
    pub start: String,
}
#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct StartTimer {
    pub description: String,
    pub project_id: String,
    pub client_id: Option<String>,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Settings {
    pub timezone: String,
    pub weekly_goal: f64,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Snapshot {
    pub clients: Vec<Client>,
    pub projects: Vec<Project>,
    pub entries: Vec<Entry>,
    pub timer: Option<Timer>,
    pub settings: Settings,
}
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Backup {
    pub format: String,
    pub version: u32,
    pub exported_at: String,
    pub data: Snapshot,
}
pub fn now() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}
pub fn id(value: &str) -> Result<()> {
    Uuid::parse_str(value)
        .map(|_| ())
        .map_err(|_| "Identifiant invalide.".into())
}
fn text(value: &mut String, max: usize, label: &str) -> Result<()> {
    *value = value.trim().to_string();
    if value.is_empty() || value.chars().count() > max {
        return Err(format!("{label} : entre 1 et {max} caractères."));
    }
    Ok(())
}
pub fn instant(value: &str) -> Result<String> {
    let parsed = DateTime::parse_from_rfc3339(value)
        .map_err(|_| "Date invalide.")?
        .with_timezone(&Utc);
    if !(2000..2100).contains(&parsed.year()) {
        return Err("La date doit être comprise entre 2000 et 2099.".into());
    }
    Ok(parsed.to_rfc3339_opts(SecondsFormat::Millis, true))
}
pub fn normalize(data: &mut Snapshot) -> Result<()> {
    if data.clients.len() > 10_000 || data.projects.len() > 10_000 || data.entries.len() > 100_000 {
        return Err("Limite de données dépassée.".into());
    }
    if data.settings.timezone.parse::<chrono_tz::Tz>().is_err()
        || !data.settings.weekly_goal.is_finite()
        || !(1.0..=168.0).contains(&data.settings.weekly_goal)
    {
        return Err("Préférences invalides.".into());
    }
    let mut clients = HashSet::new();
    for client in &mut data.clients {
        id(&client.id)?;
        text(&mut client.name, 120, "Nom du client")?;
        if !clients.insert(client.id.clone()) {
            return Err("Client en double.".into());
        }
    }
    let mut projects = HashSet::new();
    for project in &mut data.projects {
        id(&project.id)?;
        text(&mut project.name, 120, "Nom du projet")?;
        if project.color.len() != 7
            || !project.color.starts_with('#')
            || !project.color.as_bytes()[1..]
                .iter()
                .all(|c| c.is_ascii_hexdigit())
        {
            return Err("Couleur invalide.".into());
        }
        if project
            .client_id
            .as_ref()
            .is_some_and(|c| !clients.contains(c))
        {
            return Err("Client introuvable.".into());
        }
        if !projects.insert(project.id.clone()) {
            return Err("Projet en double.".into());
        }
    }
    let mut entries = HashSet::new();
    for entry in &mut data.entries {
        id(&entry.id)?;
        text(&mut entry.description, 500, "Tâche")?;
        if !projects.contains(&entry.project_id)
            || entry
                .client_id
                .as_ref()
                .is_some_and(|c| !clients.contains(c))
        {
            return Err("Projet ou client introuvable.".into());
        }
        entry.start = instant(&entry.start)?;
        entry.end = instant(&entry.end)?;
        if entry.end <= entry.start {
            return Err("La fin doit être après le début.".into());
        }
        if !entries.insert(entry.id.clone()) {
            return Err("Entrée en double.".into());
        }
    }
    let mut ordered: Vec<_> = data.entries.iter().collect();
    ordered.sort_by(|a, b| a.start.cmp(&b.start));
    for pair in ordered.windows(2) {
        if pair[1].start < pair[0].end {
            return Err("Ce créneau chevauche une autre entrée.".into());
        }
    }
    if let Some(timer) = &mut data.timer {
        text(&mut timer.description, 500, "Tâche")?;
        timer.start = instant(&timer.start)?;
        if !projects.contains(&timer.project_id)
            || timer
                .client_id
                .as_ref()
                .is_some_and(|c| !clients.contains(c))
        {
            return Err("Projet ou client introuvable.".into());
        }
        if timer.start > now() || data.entries.iter().any(|e| e.end > timer.start) {
            return Err("Le chronomètre chevauche une entrée ou démarre dans le futur.".into());
        }
    }
    Ok(())
}
impl Backup {
    pub fn new(data: Snapshot) -> Self {
        Self {
            format: "timecord".into(),
            version: 1,
            exported_at: now(),
            data,
        }
    }
    pub fn parse(bytes: &[u8]) -> Result<Self> {
        if bytes.len() as u64 > MAX_BYTES {
            return Err("Fichier trop volumineux (25 Mo maximum).".into());
        }
        let mut backup: Self =
            serde_json::from_slice(bytes).map_err(|_| "Sauvegarde JSON invalide ou incomplète.")?;
        if backup.format != "timecord" || backup.version != 1 {
            return Err("Format ou version de sauvegarde non pris en charge.".into());
        }
        normalize(&mut backup.data)?;
        Ok(backup)
    }
}
