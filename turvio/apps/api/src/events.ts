import pg from "pg";
import { pgSslOptions, type PgSsl } from "./db";

export interface ChangeEvent {
  org: string;
  depot: string | null;
  tour: string | null;
  table: "tours" | "stops";
  op: "insert" | "update" | "delete";
}

type Listener = (e: ChangeEvent) => void;

/**
 * Relays Postgres NOTIFY 'turvio_changes' (see *_dispatch_persistence.sql) to
 * in-process listeners. Payloads carry ids only; clients refetch through
 * RLS-protected endpoints. One dedicated connection, reconnects on failure.
 * With Supabase, Realtime can replace this; the SSE contract stays the same.
 */
export class ChangeFeed {
  private client: pg.Client | null = null;
  private readonly listeners = new Set<Listener>();
  private stopped = false;

  constructor(
    private readonly connectionString: string,
    private readonly log: (msg: string) => void = () => undefined,
    private readonly ssl: PgSsl = false,
  ) {}

  async start(): Promise<void> {
    if (this.stopped) return;
    const client = new pg.Client({ connectionString: this.connectionString, ssl: pgSslOptions(this.ssl) });
    client.on("notification", (msg) => {
      if (msg.channel !== "turvio_changes" || !msg.payload) return;
      try {
        const e = JSON.parse(msg.payload) as ChangeEvent;
        for (const l of this.listeners) l(e);
      } catch {
        /* ignore malformed payloads */
      }
    });
    client.on("error", (err) => {
      this.log(`change feed error: ${err.message}; reconnecting`);
      this.client = null;
      setTimeout(() => void this.start(), 2000);
    });
    await client.connect();
    await client.query("listen turvio_changes");
    this.client = client;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  get subscribers() {
    return this.listeners.size;
  }

  async stop(): Promise<void> {
    this.stopped = true;
    await this.client?.end().catch(() => undefined);
  }
}
