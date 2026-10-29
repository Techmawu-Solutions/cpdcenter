import { getDb } from "./db";
import { buildPublicDirectory, diffRecords, FIELDS, type OfficerRecord } from "./records";

type OfficerRow = {
  record_key: string;
  region: string;
  district: string;
  centre1: string;
  centre2: string;
  first_name: string;
  last_name: string;
  phone: string;
  category: string;
  designation: string;
};

export type UploadLog = {
  id: number;
  file_name: string;
  uploaded_at: string;
  total: number;
  added: number;
  updated: number;
  removed: number;
  unchanged: number;
};

const COLUMNS: Record<(typeof FIELDS)[number], keyof OfficerRow> = {
  region: "region",
  district: "district",
  centre1: "centre1",
  centre2: "centre2",
  firstName: "first_name",
  lastName: "last_name",
  phone: "phone",
  category: "category",
  designation: "designation",
};

export async function getAllRecords(): Promise<OfficerRecord[]> {
  const db = await getDb();
  const rows = await db.query<OfficerRow>(
    "SELECT * FROM officers ORDER BY region, district, last_name, first_name",
  );
  return rows.map((row) => ({
    key: row.record_key,
    ...(Object.fromEntries(FIELDS.map((f) => [f, row[COLUMNS[f]]])) as Omit<OfficerRecord, "key">),
  }));
}

export async function getPublicDirectory() {
  return buildPublicDirectory(await getAllRecords());
}

export async function getUploads(limit = 10): Promise<UploadLog[]> {
  const db = await getDb();
  const rows = await db.query<UploadLog & { uploaded_at: Date | string }>(
    "SELECT * FROM uploads ORDER BY id DESC LIMIT $1",
    [limit],
  );
  return rows.map((r) => ({ ...r, uploaded_at: new Date(r.uploaded_at).toISOString() }));
}

export async function getLastUpdated(): Promise<string | null> {
  const [last] = await getUploads(1);
  return last?.uploaded_at ?? null;
}

/**
 * Saves an uploaded file. New people are inserted, changed rows updated in place (matched
 * on the record key, so nobody is duplicated), and with removeMissing, people no longer
 * in the file are deleted.
 */
export async function applyRecords(incoming: OfficerRecord[], fileName: string, removeMissing: boolean) {
  const db = await getDb();
  const diff = diffRecords(await getAllRecords(), incoming);
  const changed = [...diff.added, ...diff.updated];
  const removed = removeMissing ? diff.removed : [];
  const queries: { text: string; params?: unknown[] }[] = [];

  if (changed.length > 0) {
    const cols = FIELDS.map((f) => COLUMNS[f]);
    queries.push({
      text: `INSERT INTO officers (record_key, ${cols.join(", ")})
        SELECT * FROM unnest(${["$1", ...cols.map((_, i) => `$${i + 2}`)].map((p) => `${p}::text[]`).join(", ")})
        ON CONFLICT (record_key) DO UPDATE SET
          ${cols.map((c) => `${c} = excluded.${c}`).join(", ")}, updated_at = now()`,
      params: [changed.map((r) => r.key), ...FIELDS.map((f) => changed.map((r) => r[f]))],
    });
  }
  if (removed.length > 0) {
    queries.push({ text: "DELETE FROM officers WHERE record_key = ANY($1::text[])", params: [removed.map((r) => r.key)] });
  }
  queries.push({
    text: "INSERT INTO uploads (file_name, total, added, updated, removed, unchanged) VALUES ($1, $2, $3, $4, $5, $6)",
    params: [fileName.slice(0, 255), incoming.length, diff.added.length, diff.updated.length, removed.length, diff.unchanged],
  });

  await db.transaction(queries);
  return { added: diff.added.length, updated: diff.updated.length, removed: removed.length, unchanged: diff.unchanged };
}
