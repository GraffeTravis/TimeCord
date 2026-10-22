"use client";
import { confirmAction } from "@/lib/desktop";
import type { Client, Project, Snapshot } from "@/lib/schema";
import { localToISO } from "@/lib/time";
import { Check, Trash2, X } from "lucide-react";
import { useEffect } from "react";
import { colors, type EntryDraft, type Mutate, type Setter } from "./types";
export function WorkspaceDialogs({
  data,
  busy,
  error,
  entryDraft,
  setEntryDraft,
  projectDraft,
  setProjectDraft,
  clientDraft,
  setClientDraft,
  setError,
  setNotice,
  mutate,
}: {
  data: Snapshot;
  busy: boolean;
  error: string;
  entryDraft: EntryDraft | null;
  setEntryDraft: Setter<EntryDraft | null>;
  projectDraft: Project | null;
  setProjectDraft: Setter<Project | null>;
  clientDraft: Client | null;
  setClientDraft: Setter<Client | null>;
  setError: Setter<string>;
  setNotice: Setter<string>;
  mutate: Mutate;
}) {
  const zone = data.settings.timezone;
  const projectById = Object.fromEntries(data.projects.map((p) => [p.id, p]));
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) {
        setEntryDraft(null);
        setProjectDraft(null);
        setClientDraft(null);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [busy, setEntryDraft, setProjectDraft, setClientDraft]);
  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) {
          setEntryDraft(null);
          setProjectDraft(null);
          setClientDraft(null);
        }
      }}
    >
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        ref={(node) => {
          if (node && !node.contains(document.activeElement))
            node.querySelector<HTMLElement>("input,button")?.focus();
        }}
        onKeyDown={(e) => {
          if (e.key !== "Tab") return;
          const elements = e.currentTarget.querySelectorAll<HTMLElement>(
            "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]",
          );
          const first = elements[0];
          const last = elements[elements.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }}
      >
        <div className="modal-heading">
          <h2 id="modal-title">
            {entryDraft
              ? data.entries.some((e) => e.id === entryDraft.id)
                ? "Modifier le temps enregistré"
                : "Ajouter du temps"
              : projectDraft
                ? data.projects.some((p) => p.id === projectDraft.id)
                  ? "Modifier le projet"
                  : "Nouveau projet"
                : clientDraft &&
                    data.clients.some((c) => c.id === clientDraft.id)
                  ? "Modifier le client"
                  : "Nouveau client"}
          </h2>
          <button
            className="icon-button"
            aria-label="Fermer"
            disabled={busy}
            onClick={() => {
              setEntryDraft(null);
              setProjectDraft(null);
              setClientDraft(null);
            }}
          >
            <X size={19} />
          </button>
        </div>
        {error && (
          <div className="alert error" role="alert">
            {error}
          </div>
        )}
        {entryDraft && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const payload = {
                  ...entryDraft,
                  clientId: entryDraft.clientId || null,
                  start: localToISO(entryDraft.start, zone),
                  end: localToISO(entryDraft.end, zone),
                };
                if (await mutate("entry", payload)) {
                  setEntryDraft(null);
                  setNotice("Temps enregistré.");
                }
              } catch (err) {
                setError(err instanceof Error ? err.message : "Date invalide.");
              }
            }}
          >
            <label className="field">
              Tâche
              <input
                autoFocus
                required
                maxLength={500}
                placeholder="Ex. Préparer la proposition"
                value={entryDraft.description}
                onChange={(e) =>
                  setEntryDraft({
                    ...entryDraft,
                    description: e.target.value,
                  })
                }
              />
            </label>
            <div className="form-grid">
              <label className="field">
                Projet
                <select
                  required
                  value={entryDraft.projectId}
                  onChange={(e) =>
                    setEntryDraft({
                      ...entryDraft,
                      projectId: e.target.value,
                      clientId: projectById[e.target.value]?.clientId || "",
                    })
                  }
                >
                  <option value="">Choisir un projet</option>
                  {data.projects
                    .filter((p) => !p.archived || p.id === entryDraft.projectId)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.archived ? " (archivé)" : ""}
                      </option>
                    ))}
                </select>
              </label>
              <label className="field">
                Client <span className="optional">facultatif</span>
                <select
                  value={entryDraft.clientId}
                  onChange={(e) =>
                    setEntryDraft({
                      ...entryDraft,
                      clientId: e.target.value,
                    })
                  }
                >
                  <option value="">Sans client</option>
                  {data.clients
                    .filter((c) => !c.archived || c.id === entryDraft.clientId)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            <div className="form-grid">
              <label className="field">
                Début
                <input
                  type="datetime-local"
                  step="1"
                  required
                  min="2000-01-01T00:00"
                  max="2099-12-31T23:59"
                  value={entryDraft.start}
                  onChange={(e) =>
                    setEntryDraft({ ...entryDraft, start: e.target.value })
                  }
                />
              </label>
              <label className="field">
                Fin
                <input
                  type="datetime-local"
                  step="1"
                  required
                  min="2000-01-01T00:00"
                  max="2099-12-31T23:59"
                  value={entryDraft.end}
                  onChange={(e) =>
                    setEntryDraft({ ...entryDraft, end: e.target.value })
                  }
                />
              </label>
            </div>
            <p className="form-help">
              Heures dans le fuseau {zone}. Pour une tâche passant minuit,
              choisissez le lendemain comme date de fin.
            </p>
            <div className="modal-actions">
              {data.entries.some((e) => e.id === entryDraft.id) && (
                <button
                  type="button"
                  className="button danger"
                  disabled={busy}
                  onClick={async () => {
                    if (
                      (await confirmAction(
                        "Supprimer définitivement cette entrée ?",
                      )) &&
                      (await mutate("deleteEntry", entryDraft.id))
                    ) {
                      setEntryDraft(null);
                      setNotice("Entrée supprimée.");
                    }
                  }}
                >
                  <Trash2 size={15} />
                  Supprimer
                </button>
              )}
              <button className="button primary push-right" disabled={busy}>
                <Check size={16} />
                Enregistrer
              </button>
            </div>
          </form>
        )}
        {projectDraft && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (await mutate("project", projectDraft)) {
                setProjectDraft(null);
                setNotice("Projet enregistré.");
              }
            }}
          >
            <label className="field">
              Nom du projet
              <input
                autoFocus
                required
                maxLength={120}
                value={projectDraft.name}
                onChange={(e) =>
                  setProjectDraft({ ...projectDraft, name: e.target.value })
                }
                placeholder="Ex. Refonte du site"
              />
            </label>
            <label className="field">
              Client <span className="optional">facultatif</span>
              <select
                value={projectDraft.clientId || ""}
                onChange={(e) =>
                  setProjectDraft({
                    ...projectDraft,
                    clientId: e.target.value || null,
                  })
                }
              >
                <option value="">Sans client</option>
                {data.clients
                  .filter((c) => !c.archived || c.id === projectDraft.clientId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="field">
              Couleur du projet
              <div className="color-picker">
                {colors.map((color) => (
                  <button
                    type="button"
                    key={color}
                    aria-label={`Couleur ${color}`}
                    style={{ background: color }}
                    onClick={() => setProjectDraft({ ...projectDraft, color })}
                  >
                    {projectDraft.color === color && <Check size={18} />}
                  </button>
                ))}
                <input
                  type="color"
                  aria-label="Couleur personnalisée"
                  value={projectDraft.color}
                  onChange={(e) =>
                    setProjectDraft({
                      ...projectDraft,
                      color: e.target.value,
                    })
                  }
                />
              </div>
            </label>
            <div className="modal-actions">
              <button className="button primary push-right" disabled={busy}>
                <Check size={16} />
                Enregistrer le projet
              </button>
            </div>
          </form>
        )}
        {clientDraft && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (await mutate("client", clientDraft)) {
                setClientDraft(null);
                setNotice("Client enregistré.");
              }
            }}
          >
            <label className="field">
              Nom du client
              <input
                autoFocus
                required
                maxLength={120}
                value={clientDraft.name}
                onChange={(e) =>
                  setClientDraft({ ...clientDraft, name: e.target.value })
                }
                placeholder="Ex. Studio Horizon"
              />
            </label>
            <div className="modal-actions">
              <button className="button primary push-right" disabled={busy}>
                <Check size={16} />
                Enregistrer le client
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
