import { mkdirSync } from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";

type Query = { text: string; params?: unknown[] };

interface Db {
  query<T>(text: string, params?: unknown[]): Promise<T[]>;
  /** Runs all queries atomically: either every one applies or none do. */
  transaction(queries: Query[]): Promise<void>;
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS officers (
    record_key  text PRIMARY KEY,
    region      text NOT NULL,
    district    text NOT NULL,
    centre1     text NOT NULL DEFAULT '',
    centre2     text NOT NULL DEFAULT '',
    first_name  text NOT NULL DEFAULT '',
    last_name   text NOT NULL DEFAULT '',
    phone       text NOT NULL DEFAULT '',
    category    text NOT NULL DEFAULT '',
    designation text NOT NULL DEFAULT '',
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS uploads (
    id          serial PRIMARY KEY,
    file_name   text NOT NULL,
    uploaded_at timestamptz NOT NULL DEFAULT now(),
    total       integer NOT NULL,
    added       integer NOT NULL,
    updated     integer NOT NULL,
    removed     integer NOT NULL,
    unchanged   integer NOT NULL
  )`,
];

function neonDb(url: string): Db {
  const sql = neon(url);
  return {
    query: async <T,>(text: string, params: unknown[] = []) => (await sql.query(text, params)) as T[],
    transaction: async (queries) => {
      await sql.transaction(queries.map((q) => sql.query(q.text, q.params ?? [])));
    },
  };
}

// Local development without a Postgres server: an embedded Postgres stored in .data/
async function localDb(): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const dataDir = path.join(process.cwd(), ".data");
  mkdirSync(dataDir, { recursive: true });
  const pg = new PGlite(path.join(dataDir, "pglite"));
  return {
    query: async <T,>(text: string, params: unknown[] = []) => (await pg.query<T>(text, params)).rows,
    transaction: async (queries) => {
      await pg.transaction(async (tx) => {
        for (const q of queries) await tx.query(q.text, q.params ?? []);
      });
    },
  };
}

const globalForDb = globalThis as unknown as { cpdDb?: Promise<Db> };

async function connect(): Promise<Db> {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url && process.env.VERCEL) {
    throw new Error("DATABASE_URL is not set. Connect a Neon Postgres database to this Vercel project.");
  }
  const db = url ? neonDb(url) : await localDb();
  for (const statement of SCHEMA) await db.query(statement);
  return db;
}

export function getDb(): Promise<Db> {
  globalForDb.cpdDb ??= connect().catch((error) => {
    globalForDb.cpdDb = undefined;
    throw error;
  });
  return globalForDb.cpdDb;
}
