// One-time local migration helper. It refuses to replace an existing populated desktop database.
#[allow(dead_code)]
#[path = "../src/models.rs"]
mod models;
#[allow(dead_code)]
#[path = "../src/store.rs"]
mod store;
use std::{fs::File, io::Read, path::Path};
fn main() -> Result<(), String> {
    let args: Vec<_> = std::env::args_os().skip(1).collect();
    if args.len() != 2 {
        return Err("Usage : migrate <sauvegarde.json> <dossier de données bureau>".into());
    }
    let mut bytes = Vec::new();
    File::open(&args[0])
        .map_err(|_| "Sauvegarde introuvable.")?
        .take(models::MAX_BYTES + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| "Lecture impossible.")?;
    let backup = models::Backup::parse(&bytes)?;
    let expected = backup.data.clone();
    let mut database = store::Store::open(Path::new(&args[1]))?;
    let existing = database.snapshot()?;
    if !existing.entries.is_empty()
        || !existing.projects.is_empty()
        || !existing.clients.is_empty()
        || existing.timer.is_some()
    {
        return Err("La base bureau contient déjà des données : import automatique refusé. Utilisez la restauration de l’interface.".into());
    }
    database.restore(backup)?;
    drop(database);
    let actual = store::Store::open(Path::new(&args[1]))?.snapshot()?;
    if actual != expected {
        return Err("La vérification après import a échoué.".into());
    }
    println!(
        "Migration vérifiée : {} projets, {} clients, {} entrées ; préférences et chronomètre conservés.",
        actual.projects.len(),
        actual.clients.len(),
        actual.entries.len()
    );
    Ok(())
}
