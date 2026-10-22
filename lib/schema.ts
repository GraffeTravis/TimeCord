export type Client = { id: string; name: string; archived: boolean };
export type Project = {
  id: string;
  name: string;
  color: string;
  clientId: string | null;
  archived: boolean;
};
export type Timer = {
  description: string;
  projectId: string;
  clientId: string | null;
  start: string;
};
export type Entry = Timer & { id: string; end: string };
export type Settings = { timezone: string; weeklyGoal: number };
export type Snapshot = {
  clients: Client[];
  projects: Project[];
  entries: Entry[];
  timer: Timer | null;
  settings: Settings;
};
