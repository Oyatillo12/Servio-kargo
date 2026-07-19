/**
 * @kargotrack/db — Drizzle ORM client + schema exports.
 *
 * Skeleton: lazily create a Postgres-backed Drizzle client from DATABASE_URL.
 * No queries yet; feature tasks build services on top of this.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema';

export * as schema from './schema';

let client: ReturnType<typeof postgres> | undefined;
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | undefined;

/** Get the shared Drizzle client, created on first use. */
export function getDb() {
  if (!dbInstance) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL is not set');
    }
    client = postgres(url);
    dbInstance = drizzle(client, { schema });
  }
  return dbInstance;
}
