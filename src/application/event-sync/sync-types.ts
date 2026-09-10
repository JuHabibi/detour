import type { EventSource } from "@/application/ports/event-source";

export const SYNC_LEASE_TTL_MS = 20 * 60 * 1000;

export type SyncSource = {
  adapterId: string;
  adapter: EventSource;
};

export type SyncErrorCode =
  | "empty_corpus"
  | "fetch_failed"
  | "transaction_failed"
  | "database_failed";

export const SYNC_ERROR_MESSAGE_SAFE: Record<SyncErrorCode, string> = {
  empty_corpus: "empty corpus rejected",
  fetch_failed: "external source fetch failed",
  transaction_failed: "sync transaction failed",
  database_failed: "database operation failed",
};

export type SyncResult =
  | {
      adapterId: string;
      status: "success";
      fetchedCount: number;
      deactivatedCount: number;
    }
  | {
      adapterId: string;
      status: "skipped";
      reason: "busy" | "lost_lease";
    }
  | {
      adapterId: string;
      status: "error";
      errorCode: SyncErrorCode;
    };

export type SyncEventSourceParams = {
  adapterId: string;
  adapter: EventSource;
  from: Date;
  to: Date;
  /** Horloge injectable — défaut `() => new Date()`. */
  now?: () => Date;
};

export type SyncEventSourcesParams = {
  sources: SyncSource[];
  from: Date;
  to: Date;
  now?: () => Date;
};
