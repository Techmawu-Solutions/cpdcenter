// Pure data logic shared by the browser (file parsing) and the server (saving, diffing,
// building the public list). No imports, so it runs anywhere.

export const FIELDS = [
  "region",
  "district",
  "centre1",
  "centre2",
  "firstName",
  "lastName",
  "phone",
  "category",
  "designation",
] as const;

export type Field = (typeof FIELDS)[number];
export type RawRow = Record<Field, string>;
export type OfficerRecord = RawRow & { key: string };

/** Column headings used when exporting, matching the original spreadsheet. */
export const HEADINGS: Record<Field, string> = {
  region: "Region",
  district: "District",
  centre1: "Name of proposed 1st centre",
  centre2: "Name of proposed 2nd centre",
  firstName: "First Name",
  lastName: "Last Name",
  phone: "Phone Number",
  category: "Officer Category",
  designation: "Designation",
};

const HEADER_TESTS: [Field, RegExp][] = [
  ["centre1", /(1st|first|1).*cent(re|er)|cent(re|er).*(1st|first|1)/],
  ["centre2", /(2nd|second|2).*cent(re|er)|cent(re|er).*(2nd|second|2)/],
  ["region", /^region/],
  ["district", /^district/],
  ["firstName", /^(first|given|other) ?names?$/],
  ["lastName", /^(last ?name|surname|family name)/],
  ["phone", /phone|mobile|contact|tel/],
  ["category", /category/],
  ["designation", /designation|position|role|title/],
];

export function clean(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).replace(/\s+/g, " ").trim();
}

/** Maps a header row to column indexes. Returns null if Region/District/centre columns are missing. */
export function mapHeader(header: unknown[]): Partial<Record<Field, number>> | null {
  const columns: Partial<Record<Field, number>> = {};
  header.forEach((cell, index) => {
    const h = clean(cell).toLowerCase();
    if (!h) return;
    const match = HEADER_TESTS.find(([field, test]) => columns[field] === undefined && test.test(h));
    if (match) columns[match[0]] = index;
  });
  const ok = columns.region !== undefined && columns.district !== undefined && (columns.centre1 !== undefined || columns.centre2 !== undefined);
  return ok ? columns : null;
}

/** Turns a sheet (array of rows) into field-mapped rows. The header may sit below a title row. */
export function tableToRawRows(table: unknown[][]): { rows: RawRow[] } | { error: string } {
  for (let i = 0; i < Math.min(table.length, 15); i++) {
    const columns = mapHeader(table[i] ?? []);
    if (!columns) continue;
    const rows = table
      .slice(i + 1)
      .filter((r) => r.some((c) => clean(c) !== ""))
      .map((r) => Object.fromEntries(FIELDS.map((f) => [f, columns[f] === undefined ? "" : clean(r[columns[f]!])])) as RawRow);
    return { rows };
  }
  return { error: "Could not find the header row. The file needs at least Region, District and proposed centre columns." };
}

/** Ghana numbers lose their leading 0 in Excel, or come with +233. Keep the 9 significant digits. */
export function normalisePhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("233")) return digits.slice(3);
  if (digits.length === 10 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

export function displayPhone(phone: string): string {
  return phone.length === 9 ? `0${phone}` : phone;
}

/**
 * The unique key that stops duplicates: the officer's phone number, or their name within
 * the district when there is no phone. Re-uploading the same person updates their row.
 */
export function recordKey(r: RawRow): string {
  if (r.phone) return `p:${r.phone}`;
  return `n:${r.region}|${r.district}|${r.firstName} ${r.lastName}`.toUpperCase();
}

export function toRecord(raw: RawRow): OfficerRecord | null {
  const r = Object.fromEntries(FIELDS.map((f) => [f, clean(raw[f])])) as RawRow;
  r.region = r.region.toUpperCase();
  r.district = r.district.toUpperCase();
  r.phone = normalisePhone(r.phone);
  if (!r.region || !r.district) return null;
  if (!r.phone && !r.firstName && !r.lastName) return null;
  return { ...r, key: recordKey(r) };
}

export function prepareRecords(raws: RawRow[]) {
  const byKey = new Map<string, OfficerRecord>();
  let skipped = 0;
  let duplicatesInFile = 0;
  for (const raw of raws) {
    const record = toRecord(raw);
    if (!record) {
      skipped++;
      continue;
    }
    if (byKey.has(record.key)) duplicatesInFile++;
    byKey.set(record.key, record); // a later row for the same person wins
  }
  return { records: [...byKey.values()], skipped, duplicatesInFile };
}

export function sameRecord(a: OfficerRecord, b: OfficerRecord): boolean {
  return FIELDS.every((f) => a[f] === b[f]);
}

export function diffRecords(existing: OfficerRecord[], incoming: OfficerRecord[]) {
  const current = new Map(existing.map((r) => [r.key, r]));
  const incomingKeys = new Set(incoming.map((r) => r.key));
  const added: OfficerRecord[] = [];
  const updated: OfficerRecord[] = [];
  let unchanged = 0;
  for (const r of incoming) {
    const before = current.get(r.key);
    if (!before) added.push(r);
    else if (!sameRecord(before, r)) updated.push(r);
    else unchanged++;
  }
  const removed = existing.filter((r) => !incomingKeys.has(r.key));
  return { added, updated, unchanged, removed };
}

// ---- Public directory ----------------------------------------------------------

export type PublicCentre = { name: string; alternative: boolean };
export type PublicDistrict = { name: string; centres: PublicCentre[] };
export type PublicRegion = { name: string; districts: PublicDistrict[] };

const PLACEHOLDER = /^(yes|no|nil|none|null|n\/?a|tbd|-+|\.+|\d+)$/i;

function centreKey(name: string): string {
  return name.toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
}

type Group = { key: string; variants: Map<string, number>; firstChoice: number; total: number };

/**
 * Collapses the officers' proposals into one list of centres per district. Spelling
 * variants ("CHURCH, AGOGO" vs "CHURCH,AGOGO") and shorter forms of the same name
 * ("MERCY BAPTIST" inside "MERCY BAPTIST CHURCH") count as one centre.
 */
function districtCentres(rows: OfficerRecord[]): PublicCentre[] {
  const groups = new Map<string, Group>();
  for (const r of rows) {
    for (const [name, first] of [
      [r.centre1, true],
      [r.centre2, false],
    ] as const) {
      if (!name || PLACEHOLDER.test(name)) continue;
      const key = centreKey(name);
      if (!key) continue;
      const g = groups.get(key) ?? { key, variants: new Map(), firstChoice: 0, total: 0 };
      g.variants.set(name, (g.variants.get(name) ?? 0) + 1);
      g.total++;
      if (first) g.firstChoice++;
      groups.set(key, g);
    }
  }

  const kept: Group[] = [];
  for (const g of [...groups.values()].sort((a, b) => b.key.length - a.key.length)) {
    const parent = kept.find((k) => ` ${k.key} `.includes(` ${g.key} `));
    if (parent) {
      parent.firstChoice += g.firstChoice;
      parent.total += g.total;
    } else {
      kept.push(g);
    }
  }

  return kept
    .sort((a, b) => Number(b.firstChoice > 0) - Number(a.firstChoice > 0) || b.total - a.total || a.key.localeCompare(b.key))
    .map((g) => ({
      name: [...g.variants.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0][0],
      alternative: g.firstChoice === 0,
    }));
}

export function buildPublicDirectory(records: OfficerRecord[]): PublicRegion[] {
  const regions = new Map<string, Map<string, OfficerRecord[]>>();
  for (const r of records) {
    const districts = regions.get(r.region) ?? new Map<string, OfficerRecord[]>();
    districts.set(r.district, [...(districts.get(r.district) ?? []), r]);
    regions.set(r.region, districts);
  }
  return [...regions.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, districts]) => ({
      name,
      districts: [...districts.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        // Districts with only placeholder answers stay listed so applicants are told none is set yet.
        .map(([district, rows]) => ({ name: district, centres: districtCentres(rows) })),
    }));
}
