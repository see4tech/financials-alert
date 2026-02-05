import { getSupabase } from './supabase-client';

type Where = Record<string, unknown>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyWhere(sb: any, where?: Where): any {
  if (!where) return sb;
  let q = sb;
  for (const [key, value] of Object.entries(where)) {
    if (value === undefined) continue;
    // TypeORM FindOperator: MoreThanOrEqual etc. have .value at runtime
    if (value !== null && typeof value === 'object' && 'value' in value) {
      const v = (value as { value: unknown }).value;
      if (v instanceof Date) q = q.gte(key, v.toISOString());
      else q = q.gte(key, v);
      continue;
    }
    // TypeORM IsNull() - FindOperator with _type
    const op = value as { _type?: string };
    if (op && typeof op === 'object' && (op._type === 'isNull' || (op as { type?: string }).type === 'isNull')) {
      q = q.is(key, null);
      continue;
    }
    q = q.eq(key, value as string | number | boolean);
  }
  return q;
}

function rowToEntity<T>(row: Record<string, unknown>, dateKeys: string[] = ['ts']): T {
  const out = { ...row } as Record<string, unknown>;
  for (const k of dateKeys) {
    if (row[k] != null) out[k] = new Date(row[k] as string);
  }
  return out as T;
}

function entityToRow(entity: Record<string, unknown>, dateKeys: string[] = ['ts']): Record<string, unknown> {
  const out = { ...entity };
  for (const k of dateKeys) {
    if (out[k] instanceof Date) out[k] = (out[k] as Date).toISOString();
  }
  return out;
}

export function createSupabaseDb(): {
  getRawRepo: () => {
    find: (opts?: { where?: Where; order?: { ts?: 'ASC' | 'DESC' }; take?: number }) => Promise<unknown[]>;
    findOne: (opts?: { where?: Where; order?: { ts?: 'ASC' | 'DESC' } }) => Promise<unknown | null>;
    save: (entity: Record<string, unknown>) => Promise<unknown>;
    insertOrIgnore: (rows: Record<string, unknown>[]) => Promise<void>;
  };
  getPointsRepo: () => {
    find: (opts?: { where?: Where; order?: { ts?: 'ASC' | 'DESC' }; take?: number }) => Promise<unknown[]>;
    findOne: (opts?: { where?: Where; order?: { ts?: 'ASC' | 'DESC' } }) => Promise<unknown | null>;
    save: (entity: Record<string, unknown>) => Promise<unknown>;
    insertOrIgnore: (rows: Record<string, unknown>[]) => Promise<void>;
  };
  getDerivedRepo: () => {
    find: (opts?: { where?: Where; order?: { ts?: 'ASC' | 'DESC' }; take?: number }) => Promise<unknown[]>;
    findOne: (opts?: { where?: Where; order?: { ts?: 'ASC' | 'DESC' } }) => Promise<unknown | null>;
    save: (entity: Record<string, unknown>) => Promise<unknown>;
    insertOrIgnore: (rows: Record<string, unknown>[]) => Promise<void>;
  };
  getSnapshotRepo: () => {
    find: (opts?: { where?: Where; order?: { ts?: 'ASC' | 'DESC' }; take?: number }) => Promise<unknown[]>;
    findOne: (opts?: { where?: Where; order?: { ts?: 'ASC' | 'DESC' } }) => Promise<unknown | null>;
    save: (entity: Record<string, unknown>) => Promise<unknown>;
  };
  getScoreRepo: () => {
    find: (opts?: { where?: Where; order?: { ts?: 'ASC' | 'DESC'; week_start_date?: 'ASC' | 'DESC' }; take?: number }) => Promise<unknown[]>;
    findOne: (opts?: { where?: Where; order?: { ts?: 'ASC' | 'DESC'; week_start_date?: 'ASC' | 'DESC' } }) => Promise<unknown | null>;
    save: (entity: Record<string, unknown>) => Promise<unknown>;
  };
  getRuleRepo: () => {
    find: (opts?: { where?: Where; order?: { ts?: 'ASC' | 'DESC' }; take?: number }) => Promise<unknown[]>;
    findOne: (opts?: { where?: Where; order?: { ts?: 'ASC' | 'DESC' } }) => Promise<unknown | null>;
    save: (entity: Record<string, unknown>) => Promise<unknown>;
  };
  getFiredRepo: () => {
    find: (opts?: { where?: Where; order?: { ts?: 'ASC' | 'DESC' }; take?: number }) => Promise<unknown[]>;
    findOne: (opts?: { where?: Where; order?: { ts?: 'ASC' | 'DESC' } }) => Promise<unknown | null>;
    save: (entity: Record<string, unknown>) => Promise<unknown>;
  };
  getDeliveryRepo: () => {
    find: (opts?: { where?: Where; order?: { ts?: 'ASC' | 'DESC' }; take?: number }) => Promise<unknown[]>;
    findOne: (opts?: { where?: Where; order?: { ts?: 'ASC' | 'DESC' } }) => Promise<unknown | null>;
    save: (entity: Record<string, unknown>) => Promise<unknown>;
  };
} {
  const supabase = getSupabase();

  function makeRepo(
    table: string,
    opts: { insertOrIgnore?: boolean; conflictColumns?: string; dateKeys?: string[]; defaultOrderKey?: string } = {},
  ) {
    const dateKeys = opts.dateKeys ?? ['ts'];
    const insertOrIgnore = opts.insertOrIgnore ?? false;
    const conflictColumns = opts.conflictColumns ?? 'id';
    const defaultOrderKey = opts.defaultOrderKey ?? 'ts';

    return {
      async find(opts?: { where?: Where; order?: { ts?: 'ASC' | 'DESC'; week_start_date?: 'ASC' | 'DESC'; id?: 'ASC' | 'DESC' }; take?: number }) {
        let q = applyWhere(supabase.from(table).select('*'), opts?.where);
        const orderEntry = opts?.order ? Object.entries(opts.order)[0] : undefined;
        const orderKey = orderEntry?.[0] ?? defaultOrderKey;
        const asc = (orderEntry?.[1] ?? 'ASC') === 'ASC';
        q = q.order(orderKey, { ascending: asc });
        if (opts?.take) q = q.limit(opts.take);
        const { data, error } = (await q) as { data: Record<string, unknown>[] | null; error: Error | null };
        if (error) throw error;
        return (data ?? []).map((r: Record<string, unknown>) => rowToEntity(r, dateKeys));
      },
      async findOne(opts?: { where?: Where; order?: { ts?: 'ASC' | 'DESC'; week_start_date?: 'ASC' | 'DESC'; id?: 'ASC' | 'DESC' } }) {
        let q = applyWhere(supabase.from(table).select('*'), opts?.where);
        const orderEntry = opts?.order ? Object.entries(opts.order)[0] : undefined;
        const orderKey = orderEntry?.[0] ?? defaultOrderKey;
        const asc = (orderEntry?.[1] ?? 'DESC') === 'ASC';
        q = q.order(orderKey, { ascending: asc }).limit(1);
        const { data, error } = (await q) as { data: Record<string, unknown>[] | null; error: Error | null };
        if (error) throw error;
        const row = (data ?? [])[0];
        return row ? rowToEntity(row as Record<string, unknown>, dateKeys) : null;
      },
      async save(entity: Record<string, unknown>) {
        const row = entityToRow(entity, dateKeys);
        if (row.id) {
          const { data, error } = await supabase.from(table).update(row).eq('id', row.id).select().single();
          if (error) throw error;
          return rowToEntity(data as Record<string, unknown>, dateKeys);
        }
        const { data, error } = await supabase.from(table).insert(row).select().single();
        if (error) throw error;
        return rowToEntity(data as Record<string, unknown>, dateKeys);
      },
      async remove(entity: Record<string, unknown>) {
        if (!entity.id) return;
        const { error } = await supabase.from(table).delete().eq('id', entity.id);
        if (error) throw error;
      },
      ...(insertOrIgnore
        ? {
            async insertOrIgnore(rows: Record<string, unknown>[]) {
              const toInsert = rows.map((r) => entityToRow(r, dateKeys));
              const { error } = await supabase.from(table).upsert(toInsert, {
                onConflict: conflictColumns,
                ignoreDuplicates: true,
              });
              if (error) throw error;
            },
          }
        : {}),
    };
  }

  return {
    getRawRepo: () =>
      makeRepo('indicator_points_raw', { insertOrIgnore: true, conflictColumns: 'indicator_key,ts', dateKeys: ['ts'] }) as ReturnType<typeof makeRepo> & { insertOrIgnore: (rows: Record<string, unknown>[]) => Promise<void> },
    getPointsRepo: () =>
      makeRepo('indicator_points', { insertOrIgnore: true, conflictColumns: 'indicator_key,ts', dateKeys: ['ts'] }) as ReturnType<typeof makeRepo> & { insertOrIgnore: (rows: Record<string, unknown>[]) => Promise<void> },
    getDerivedRepo: () =>
      makeRepo('derived_metrics', { insertOrIgnore: true, conflictColumns: 'indicator_key,ts', dateKeys: ['ts'] }) as ReturnType<typeof makeRepo> & { insertOrIgnore: (rows: Record<string, unknown>[]) => Promise<void> },
    getSnapshotRepo: () => makeRepo('status_snapshots', { dateKeys: ['ts'] }),
    getScoreRepo: () => makeRepo('weekly_scores', { dateKeys: [], defaultOrderKey: 'week_start_date' }),
    getRuleRepo: () => makeRepo('alert_rules', { defaultOrderKey: 'id' }),
    getFiredRepo: () => makeRepo('alerts_fired', { dateKeys: ['ts'] }),
    getDeliveryRepo: () => makeRepo('notification_deliveries', { dateKeys: ['ts'] }),
  };
}
