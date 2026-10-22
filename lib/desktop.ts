import { invoke, isTauri } from "@tauri-apps/api/core";
import type { Snapshot } from "./schema";
const commands: Record<string, string> = {
  client: "save_client",
  project: "save_project",
  entry: "save_entry",
  deleteEntry: "delete_entry",
  startTimer: "start_timer",
  stopTimer: "stop_timer",
  settings: "save_settings",
};
export function desktopReady() {
  return isTauri();
}
export function loadSnapshot() {
  return invoke<Snapshot>("snapshot");
}
export function mutateSnapshot(action: string, payload?: unknown) {
  const command = commands[action];
  if (!command) throw new Error("Action inconnue.");
  return invoke<Snapshot>(command, payload === undefined ? {} : { payload });
}
export function exportBackup() {
  return invoke<boolean>("export_backup");
}
export function importBackup() {
  return invoke<Snapshot | null>("import_backup");
}
export function saveCSV(content: string) {
  return invoke<boolean>("export_csv", { content });
}
export function confirmAction(message: string) {
  return invoke<boolean>("confirm_action", { message });
}
export function desktopError(error: unknown) {
  return error instanceof Error
    ? error.message
    : typeof error === "string"
      ? error
      : "Opération impossible.";
}
