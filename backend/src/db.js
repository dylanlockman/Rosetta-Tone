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

// Run schema
const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
db.run(schema);

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
