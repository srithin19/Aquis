/**
 * A drop-in for the slice of expo-sqlite the app uses, backed by sql.js — the
 * real SQLite engine compiled to WebAssembly. Repositories run their actual
 * SQL against it, migrations included.
 *
 * `__resetDatabase()` gives each test a brand-new, fully migrated database.
 */

import initSqlJs, { type Database, type SqlValue } from 'sql.js';

import { MIGRATIONS } from '../../src/db/schema';

type Params = SqlValue[] | undefined;

let SQL: Awaited<ReturnType<typeof initSqlJs>> | null = null;
let current: Database | null = null;

async function engine() {
  if (!SQL) SQL = await initSqlJs();
  return SQL;
}

function migrated(sql: NonNullable<typeof SQL>): Database {
  const db = new sql.Database();
  for (const migration of MIGRATIONS) {
    for (const statement of migration.statements) db.exec(statement);
    db.exec(`PRAGMA user_version = ${migration.id};`);
  }
  return db;
}

export async function __resetDatabase(): Promise<void> {
  const sql = await engine();
  current?.close();
  current = migrated(sql);
}

/** Raw access for assertions in tests. */
export function __query<T = Record<string, SqlValue>>(sqlText: string, params: SqlValue[] = []): T[] {
  if (!current) throw new Error('database not opened');
  const statement = current.prepare(sqlText);
  statement.bind(params);
  const rows: T[] = [];
  while (statement.step()) rows.push(statement.getAsObject() as T);
  statement.free();
  return rows;
}

function db(): Database {
  if (!current) throw new Error('database not opened — call __resetDatabase() in beforeEach');
  return current;
}

const handle = {
  async execAsync(sqlText: string) {
    db().exec(sqlText);
  },
  async runAsync(sqlText: string, params?: Params) {
    db().run(sqlText, params ?? []);
    return { changes: db().getRowsModified(), lastInsertRowId: 0 };
  },
  async getFirstAsync<T>(sqlText: string, params?: Params): Promise<T | null> {
    return (__query<T>(sqlText, params ?? [])[0] ?? null) as T | null;
  },
  async getAllAsync<T>(sqlText: string, params?: Params): Promise<T[]> {
    return __query<T>(sqlText, params ?? []);
  },
  async withTransactionAsync(fn: () => Promise<void>) {
    db().exec('BEGIN;');
    try {
      await fn();
      db().exec('COMMIT;');
    } catch (error) {
      db().exec('ROLLBACK;');
      throw error;
    }
  },
};

export async function openDatabaseAsync() {
  if (!current) await __resetDatabase();
  return handle;
}

export type SQLiteDatabase = typeof handle;
