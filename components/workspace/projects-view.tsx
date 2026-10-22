"use client";
import type { Client, Project, Snapshot } from "@/lib/schema";
import { hours, secondsBetween } from "@/lib/time";
import {
  Archive,
  FolderKanban,
  Pencil,
  Plus,
  RotateCcw,
  Users,
} from "lucide-react";
import { Empty } from "./shared";
import { colors, type Mutate, type Setter } from "./types";
export function ProjectsView({
  data,
  busy,
  showArchived,
  setShowArchived,
  setProjectDraft,
  setClientDraft,
  clientById,
  mutate,
}: {
  data: Snapshot;
  busy: boolean;
  showArchived: boolean;
  setShowArchived: Setter<boolean>;
  setProjectDraft: Setter<Project | null>;
  setClientDraft: Setter<Client | null>;
  clientById: Record<string, Client>;
  mutate: Mutate;
}) {
  return (
    <>
      <div className="section-heading">
        <h2>
          Vos projets <span className="count">{data.projects.length}</span>
        </h2>
        <div className="heading-actions">
          <label className="check-label">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Afficher les archives
          </label>
          <button
            className="button primary"
            onClick={() =>
              setProjectDraft({
                id: crypto.randomUUID(),
                name: "",
                color: colors[data.projects.length % colors.length],
                clientId: null,
                archived: false,
              })
            }
          >
            <Plus size={16} />
            Nouveau projet
          </button>
        </div>
      </div>
      {!data.projects.filter((p) => showArchived || !p.archived).length && (
        <Empty
          icon={<FolderKanban size={28} />}
          title="Donnez un nom à votre prochain projet"
          text="Organisez votre temps autour des projets qui vous occupent."
        />
      )}
      <div className="projects-grid">
        {data.projects
          .filter((p) => showArchived || !p.archived)
          .map((p) => {
            const seconds = data.entries
              .filter((e) => e.projectId === p.id)
              .reduce((sum, e) => sum + secondsBetween(e.start, e.end), 0);
            return (
              <article
                className={`project-card ${p.archived ? "archived" : ""}`}
                key={p.id}
              >
                <div className="project-card-top">
                  <span
                    className="project-symbol"
                    style={{
                      color: p.color,
                      background: `${p.color}15`,
                    }}
                  >
                    <FolderKanban size={22} />
                  </span>
                  <div className="entry-actions">
                    <button
                      className="icon-button"
                      aria-label={`Modifier le projet ${p.name}`}
                      onClick={() => setProjectDraft(p)}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      className="icon-button"
                      disabled={busy || data.timer?.projectId === p.id}
                      aria-label={`${p.archived ? "Restaurer" : "Archiver"} le projet ${p.name}`}
                      onClick={() =>
                        void mutate("project", {
                          ...p,
                          archived: !p.archived,
                        })
                      }
                    >
                      {p.archived ? (
                        <RotateCcw size={16} />
                      ) : (
                        <Archive size={16} />
                      )}
                    </button>
                  </div>
                </div>
                <h3>{p.name}</h3>
                <p>
                  {p.clientId ? clientById[p.clientId]?.name : "Sans client"}
                  {p.archived ? " · Archivé" : ""}
                </p>
                <div className="project-card-foot">
                  <strong>{hours(seconds)}</strong>
                  <span>au total</span>
                  <span
                    className="push-right color-dot"
                    style={{ background: p.color }}
                  />
                </div>
              </article>
            );
          })}
      </div>
      <div className="section-heading clients-heading">
        <h2>
          Vos clients <span className="count">{data.clients.length}</span>
        </h2>
        <button
          className="button secondary"
          onClick={() =>
            setClientDraft({
              id: crypto.randomUUID(),
              name: "",
              archived: false,
            })
          }
        >
          <Plus size={16} />
          Nouveau client
        </button>
      </div>
      {!data.clients.filter((c) => showArchived || !c.archived).length ? (
        <div className="panel padded muted">
          Les clients sont facultatifs. Ajoutez-en un si vous souhaitez
          regrouper votre travail par client.
        </div>
      ) : (
        <div className="panel">
          {data.clients
            .filter((c) => showArchived || !c.archived)
            .map((c) => (
              <div className="client-row" key={c.id}>
                <span className="client-avatar">
                  <Users size={18} />
                </span>
                <strong>{c.name}</strong>
                {c.archived && <span className="muted">Archivé</span>}
                <span className="push-right muted">
                  {data.projects.filter((p) => p.clientId === c.id).length}{" "}
                  projet(s)
                </span>
                <button
                  className="icon-button"
                  aria-label={`Modifier le client ${c.name}`}
                  onClick={() => setClientDraft(c)}
                >
                  <Pencil size={16} />
                </button>
                <button
                  className="icon-button"
                  disabled={busy || data.timer?.clientId === c.id}
                  aria-label={`${c.archived ? "Restaurer" : "Archiver"} le client ${c.name}`}
                  onClick={() =>
                    void mutate("client", {
                      ...c,
                      archived: !c.archived,
                    })
                  }
                >
                  {c.archived ? <RotateCcw size={16} /> : <Archive size={16} />}
                </button>
              </div>
            ))}
        </div>
      )}
    </>
  );
}
