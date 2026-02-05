import { DataSource, Repository } from 'typeorm';
import {
  IndicatorPointRaw,
  IndicatorPoint,
  DerivedMetric,
  StatusSnapshot,
  WeeklyScore,
  AlertRule,
  AlertFired,
  NotificationDelivery,
} from './entities';

type RepoWithInsert = {
  find: Repository<IndicatorPointRaw>['find'];
  findOne: Repository<IndicatorPointRaw>['findOne'];
  save: Repository<IndicatorPointRaw>['save'];
  insertOrIgnore: (rows: unknown[]) => Promise<void>;
};

function wrapRepoWithInsert<T extends object>(repo: Repository<T>, Entity: new () => T): RepoWithInsert {
  return {
    find: repo.find.bind(repo) as Repository<IndicatorPointRaw>['find'],
    findOne: repo.findOne.bind(repo) as Repository<IndicatorPointRaw>['findOne'],
    save: repo.save.bind(repo) as Repository<IndicatorPointRaw>['save'],
    async insertOrIgnore(rows: unknown[]) {
      for (const row of rows) {
        await repo
          .createQueryBuilder()
          .insert()
          .into(Entity as never)
          .values(row as never)
          .orIgnore()
          .execute();
      }
    },
  };
}

function wrapRepo<T extends object>(repo: Repository<T>): { find: Repository<T>['find']; findOne: Repository<T>['findOne']; save: Repository<T>['save']; remove: Repository<T>['remove'] } {
  return {
    find: repo.find.bind(repo),
    findOne: repo.findOne.bind(repo),
    save: repo.save.bind(repo),
    remove: repo.remove.bind(repo),
  };
}

export function createTypeOrmDb(ds: DataSource): {
  getRawRepo: () => RepoWithInsert;
  getPointsRepo: () => RepoWithInsert;
  getDerivedRepo: () => RepoWithInsert;
  getSnapshotRepo: () => ReturnType<typeof wrapRepo>;
  getScoreRepo: () => ReturnType<typeof wrapRepo>;
  getRuleRepo: () => ReturnType<typeof wrapRepo>;
  getFiredRepo: () => ReturnType<typeof wrapRepo>;
  getDeliveryRepo: () => ReturnType<typeof wrapRepo>;
} {
  return {
    getRawRepo: () => wrapRepoWithInsert(ds.getRepository(IndicatorPointRaw), IndicatorPointRaw),
    getPointsRepo: () => wrapRepoWithInsert(ds.getRepository(IndicatorPoint), IndicatorPoint),
    getDerivedRepo: () => wrapRepoWithInsert(ds.getRepository(DerivedMetric), DerivedMetric),
    getSnapshotRepo: () => wrapRepo(ds.getRepository(StatusSnapshot)),
    getScoreRepo: () => wrapRepo(ds.getRepository(WeeklyScore)),
    getRuleRepo: () => wrapRepo(ds.getRepository(AlertRule)),
    getFiredRepo: () => wrapRepo(ds.getRepository(AlertFired)),
    getDeliveryRepo: () => wrapRepo(ds.getRepository(NotificationDelivery)),
  };
}
