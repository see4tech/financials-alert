import { DataSource } from 'typeorm';
import * as entities from './entities';

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
