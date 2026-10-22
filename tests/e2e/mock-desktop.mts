import type { Page } from "@playwright/test";
import type { Snapshot } from "../../lib/schema";
export async function mockDesktop(
  page: Page,
  initial: Snapshot = {
    clients: [],
    projects: [],
    entries: [],
    timer: null,
    settings: { timezone: "Pacific/Tahiti", weeklyGoal: 35 },
  },
) {
  await page.addInitScript((initial: Snapshot) => {
    const host = window as unknown as {
      isTauri: boolean;
      __TAURI_INTERNALS__: {
        invoke: (
          command: string,
          args?: Record<string, unknown>,
        ) => Promise<unknown>;
      };
      lastCSV: string;
    };
    host.isTauri = true;
    host.__TAURI_INTERNALS__ = {
      invoke: async (command, args = {}) => {
        const state = JSON.parse(
          localStorage.getItem("renderer-test") || JSON.stringify(initial),
        );
        const payload = args.payload as Record<string, unknown>;
        if (command === "snapshot") return state;
        if (command === "confirm_action") return true;
        if (command === "export_csv") {
          host.lastCSV = args.content as string;
          return true;
        }
        if (command === "export_backup") {
          localStorage.setItem("renderer-backup", JSON.stringify(state));
          return true;
        }
        if (command === "import_backup") {
          const saved = JSON.parse(localStorage.getItem("renderer-backup")!);
          localStorage.setItem("renderer-test", JSON.stringify(saved));
          return saved;
        }
        if (["save_client", "save_project", "save_entry"].includes(command)) {
          const list =
            state[
              command === "save_client"
                ? "clients"
                : command === "save_project"
                  ? "projects"
                  : "entries"
            ];
          const index = list.findIndex(
            (v: { id: string }) => v.id === payload.id,
          );
          if (index === -1) list.push(payload);
          else list[index] = payload;
        } else if (command === "start_timer")
          state.timer = { ...payload, start: new Date().toISOString() };
        else if (command === "stop_timer") {
          state.entries.push({
            ...state.timer,
            id: crypto.randomUUID(),
            end: new Date().toISOString(),
          });
          state.timer = null;
        } else if (command === "delete_entry")
          state.entries = state.entries.filter(
            (e: { id: string }) => e.id !== args.payload,
          );
        else if (command === "save_settings") state.settings = payload;
        else throw new Error(`Commande non simulée : ${command}`);
        localStorage.setItem("renderer-test", JSON.stringify(state));
        return state;
      },
    };
  }, initial);
}
