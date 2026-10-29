import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPublicDirectory, diffRecords, normalisePhone, prepareRecords, tableToRawRows, type RawRow } from "./records.ts";

const header = ["Region", "District", "Name of proposed 1st centre", "Name of proposed 2nd centre", "First Name", "Last Name", "Phone Number", "Officer Category", "Designation"];

function rows(table: unknown[][]): RawRow[] {
  const result = tableToRawRows(table);
  assert.ok("rows" in result);
  return result.rows;
}

test("phone numbers in different formats are the same person", () => {
  assert.equal(normalisePhone("262967736"), "262967736");
  assert.equal(normalisePhone("0262967736"), "262967736");
  assert.equal(normalisePhone("+233 26 296 7736"), "262967736");
});

test("finds the header below a title row and maps columns", () => {
  const raw = rows([["NATIONAL CPD TRAINING"], header, ["Ashanti ", "kumasi  metropolitan", "STATE BOYS", "", "ISAAC", "BROWN", 245796435, "District Officer", "DTO"]]);
  assert.equal(raw.length, 1);
  assert.equal(raw[0].district, "kumasi metropolitan");
  assert.equal(raw[0].phone, "245796435");
});

test("rejects a file without the expected columns", () => {
  assert.ok("error" in tableToRawRows([["Name", "Age"], ["A", 1]]));
});

test("repeated people in one file are merged, the last row wins", () => {
  const { records, duplicatesInFile } = prepareRecords(
    rows([header, ["A", "D", "OLD", "", "X", "Y", "0241111111", "", ""], ["A", "D", "NEW", "", "X", "Y", "241111111", "", ""]]),
  );
  assert.equal(records.length, 1);
  assert.equal(duplicatesInFile, 1);
  assert.equal(records[0].centre1, "NEW");
});

test("re-uploading updates instead of duplicating", () => {
  const first = prepareRecords(rows([header, ["A", "D", "C1", "", "X", "Y", "241111111", "", ""], ["A", "D", "C2", "", "P", "Q", "242222222", "", ""]])).records;
  const second = prepareRecords(rows([header, ["A", "D", "C1 CHANGED", "", "X", "Y", "0241111111", "", ""], ["A", "E", "C3", "", "M", "N", "243333333", "", ""]])).records;
  const diff = diffRecords(first, second);
  assert.equal(diff.added.length, 1);
  assert.equal(diff.updated.length, 1);
  assert.equal(diff.unchanged, 0);
  assert.deepEqual(diff.removed.map((r) => r.phone), ["242222222"]);
});

test("public list merges spelling variants and drops placeholders", () => {
  const { records } = prepareRecords(
    rows([
      header,
      ["ASHANTI", "ASANTE AKIM NORTH", "CHRIST APOSTOLIC CHURCH, AGOGO", "", "A", "B", "1", "", ""],
      ["ASHANTI", "ASANTE AKIM NORTH", "CHRIST APOSTOLIC CHURCH,AGOGO", "YES", "C", "D", "2", "", ""],
      ["ASHANTI", "OFORIKROM", "MERCY BAPTIST", "300", "E", "F", "3", "", ""],
      ["ASHANTI", "OFORIKROM", "MERCY BAPTIST CHURCH", "N/A", "G", "H", "4", "", ""],
      ["ASHANTI", "OFORIKROM", "", "ANLOGA JHS", "I", "J", "5", "", ""],
    ]),
  );
  const [ashanti] = buildPublicDirectory(records);
  assert.deepEqual(ashanti.districts[0].centres, [{ name: "CHRIST APOSTOLIC CHURCH, AGOGO", alternative: false }]);
  assert.deepEqual(ashanti.districts[1].centres, [
    { name: "MERCY BAPTIST CHURCH", alternative: false },
    { name: "ANLOGA JHS", alternative: true },
  ]);
});
