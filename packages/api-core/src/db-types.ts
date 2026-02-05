/**
 * Normalized where shape so we can use either TypeORM (with DATABASE_URL) or
 * Supabase REST (when Postgres is not directly accessible).
 * - ts_gte: Date -> ts >= value
 * - user_id_null: true -> user_id IS NULL
 * - Other keys: exact match.
 */
export type NormalizedWhere = Record<string, unknown> & {
  indicator_key?: string;
  ts_gte?: Date;
  ts?: Date;
  granularity?: string;
  week_start_date?: string;
  user_id_null?: true;
  is_enabled?: boolean;
  rule_id?: string;
  dedupe_key?: string;
};

export interface FindManyOptions<T = unknown> {
  where?: Record<string, unknown>;
  order?: { ts?: 'ASC' | 'DESC'; week_start_date?: 'ASC' | 'DESC'; id?: 'ASC' | 'DESC' };
  take?: number;
}

export interface FindOneOptions<T = unknown> {
  where?: Record<string, unknown>;
  order?: { ts?: 'ASC' | 'DESC'; week_start_date?: 'ASC' | 'DESC'; id?: 'ASC' | 'DESC' };
}

export interface RepoWithInsert<T = unknown> {
  find(options?: FindManyOptions<T>): Promise<T[]>;
  findOne(options?: FindOneOptions<T>): Promise<T | null>;
  save(entity: Partial<T>): Promise<T>;
  insertOrIgnore(rows: Partial<T>[]): Promise<void>;
}

export interface Repo<T = unknown> {
  find(options?: FindManyOptions<T>): Promise<T[]>;
  findOne(options?: FindOneOptions<T>): Promise<T | null>;
  save(entity: Partial<T>): Promise<T>;
  remove?(entity: T): Promise<void>;
}

export interface DbConnection {
  getRawRepo(): RepoWithInsert;
  getPointsRepo(): RepoWithInsert;
  getDerivedRepo(): RepoWithInsert;
  getSnapshotRepo(): Repo;
  getScoreRepo(): Repo;
  getRuleRepo(): Repo;
  getFiredRepo(): Repo;
  getDeliveryRepo(): Repo;
}
