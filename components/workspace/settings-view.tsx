"use client";
import type { Snapshot } from "@/lib/schema";
import {
  Check,
  Download,
  HardDrive,
  RotateCcw,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import { type Mutate, type Setter } from "./types";
export function SettingsView({
  settingsDraft,
  setSettingsDraft,
  busy,
  mutate,
  setNotice,
  backup,
  restore,
}: {
  settingsDraft: Snapshot["settings"];
  setSettingsDraft: Setter<Snapshot["settings"]>;
  busy: boolean;
  mutate: Mutate;
  setNotice: Setter<string>;
  backup: () => Promise<void>;
  restore: () => Promise<void>;
}) {
  return (
    <div className="settings-grid">
      <section className="panel padded">
        <div className="settings-icon">
          <Settings2 size={22} />
        </div>
        <h2>Vos préférences</h2>
        <p className="muted">
          Les dates et rapports suivent le fuseau sélectionné.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (await mutate("settings", settingsDraft))
              setNotice("Préférences enregistrées.");
          }}
        >
          <label className="field">
            Fuseau horaire
            <input
              required
              list="timezones"
              value={settingsDraft.timezone}
              onChange={(e) =>
                setSettingsDraft({
                  ...settingsDraft,
                  timezone: e.target.value,
                })
              }
            />
            <datalist id="timezones">
              {[
                "Pacific/Tahiti",
                "Europe/Paris",
                "UTC",
                "America/Montreal",
                "Pacific/Noumea",
                "Indian/Reunion",
              ].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </datalist>
          </label>
          <label className="field">
            Objectif hebdomadaire (heures)
            <input
              type="number"
              min="1"
              max="168"
              step="0.5"
              required
              value={settingsDraft.weeklyGoal}
              onChange={(e) =>
                setSettingsDraft({
                  ...settingsDraft,
                  weeklyGoal: Number(e.target.value),
                })
              }
            />
          </label>
          <button className="button primary" disabled={busy}>
            <Check size={16} />
            Enregistrer
          </button>
        </form>
      </section>
      <section className="panel padded">
        <div className="settings-icon green">
          <HardDrive size={22} />
        </div>
        <h2>Vos données, chez vous</h2>
        <p className="muted">
          Une sauvegarde contient vos projets, clients, entrées, préférences et
          le chronomètre actif. Conservez une copie hors de cet ordinateur.
        </p>
        <button
          className="button secondary full-width"
          disabled={busy}
          onClick={backup}
        >
          <Download size={16} />
          Enregistrer une sauvegarde complète
        </button>
        <div className="restore-section">
          <h3>Restaurer une sauvegarde</h3>
          <p className="muted">
            La restauration remplace les données actuelles. Une copie de
            sécurité est conservée dans le dossier de données de Timecord avant
            le remplacement.
          </p>
          <button
            className="button secondary full-width"
            disabled={busy}
            onClick={restore}
          >
            <RotateCcw size={16} />
            Choisir un fichier de sauvegarde
          </button>
        </div>{" "}
        <div className="privacy-note">
          <ShieldCheck size={18} />
          <span>
            Aucun compte cloud. Aucune télémétrie. Toutes les ressources sont
            servies localement.
          </span>
        </div>
      </section>
    </div>
  );
}
