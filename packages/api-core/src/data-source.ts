import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as entities from './entities';
import { useSupabase } from './supabase-client';
import { createSupabaseDb } from './db-supabase';
import { createTypeOrmDb } from './db-typeorm';

let dataSource: DataSource | null = null;

export function getDataSource(): DataSource {
  if (!dataSource) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is required');
    dataSource = new DataSource({
      type: 'postgres',
      url,
      entities: Object.values(entities),
      synchronize: false,
      logging: false,
    });
  }
  return dataSource;
}

export async function ensureDataSource(): Promise<DataSource> {
  const ds = getDataSource();
  if (!ds.isInitialized) await ds.initialize();
  return ds;
}

export type Db = ReturnType<typeof createTypeOrmDb>;

let cachedDb: Db | null = null;

/**
 * Returns a unified DB connection. Uses Supabase REST (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
 * when Postgres is not directly accessible (no DATABASE_URL). Otherwise uses TypeORM with DATABASE_URL.
 */
export async function getDb(): Promise<Db> {
  if (cachedDb) return cachedDb;
  if (useSupabase()) {
    cachedDb = createSupabaseDb() as unknown as Db;
  } else {
    const ds = await ensureDataSource();
    cachedDb = createTypeOrmDb(ds);
  }
  return cachedDb;
}
