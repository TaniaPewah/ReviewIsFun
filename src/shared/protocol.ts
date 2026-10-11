import type { ReviewSession } from "../core/types";

export type WebviewMessage =
  | { type: "ready" }
  | { type: "startLatest" }
  | { type: "selectCommit" }
  | { type: "submitAnswer"; answer: string }
  | { type: "retry" }
  | { type: "continue" }
  | { type: "skip" }
  | { type: "openDiff"; path: string }
  | { type: "restart" };

export interface ViewState {
  phase: "idle" | "loading" | "session" | "error";
  session: ReviewSession | null;
  commit?: { sha: string; message: string; parentSha: string | null; isMerge: boolean };
  coverage?: { path: string; status: string; summaryReason?: string }[];
  error?: string;
  busyMessage?: string;
  reducedMotion: boolean;
  artUrl: string;
}

export type HostMessage = { type: "state"; state: ViewState };
