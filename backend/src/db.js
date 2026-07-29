import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { seedDatabase } from './seed.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');
const dbPath = join(dataDir, 'gearboard.db');

if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

const SQL = await initSqlJs();

let db;
if (existsSync(dbPath)) {
  const buffer = readFileSync(dbPath);
  db = new SQL.Database(buffer);
} else {
  db = new SQL.Database();
}

// Migration: older DB files have a songs.source_type CHECK that predates
// 'midi'. SQLite can't alter a CHECK, so rebuild the table once if needed.
const songsDDL = db.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='songs'");
const existingDDL = songsDDL[0]?.values?.[0]?.[0] ?? null;
if (existingDDL && !existingDDL.includes("'midi'")) {
  db.run('ALTER TABLE songs RENAME TO songs_migrate_old');
}

// Run schema
const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
db.run(schema);

// Finish migration: copy rows into the rebuilt table, then drop the old one
const oldTable = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='songs_migrate_old'");
if (oldTable.length > 0) {
  db.run('INSERT INTO songs SELECT * FROM songs_migrate_old');
  db.run('DROP TABLE songs_migrate_old');
}

// Seed reference data
seedDatabase(db);

// Persist to disk
function save() {
  const data = db.export();
  writeFileSync(dbPath, Buffer.from(data));
}

// Save after seeding
save();

// Helper: wraps sql.js for a friendlier API
export function all(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

export function get(sql, params = []) {
  const rows = all(sql, params);
  return rows[0] || null;
}

export function run(sql, params = []) {
  db.run(sql, params);
  const changes = db.getRowsModified();
  const ridResult = db.exec('SELECT last_insert_rowid()');
  const lastInsertRowid = ridResult[0]?.values?.[0]?.[0] ?? 0;
  save();
  return { lastInsertRowid, changes };
}

export default db;
