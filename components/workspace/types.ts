import type { Dispatch, SetStateAction } from "react";
export type Setter<T> = Dispatch<SetStateAction<T>>;
export type Mutate = (action: string, payload?: unknown) => Promise<boolean>;
export type EntryDraft = {
  id: string;
  description: string;
  projectId: string;
  clientId: string;
  start: string;
  end: string;
};
export const colors = [
  "#7560db",
  "#358b78",
  "#d78b41",
  "#4d8bc0",
  "#c0648c",
  "#667b47",
];
