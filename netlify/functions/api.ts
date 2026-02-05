import express, { Request, Response } from 'express';
import serverless from 'serverless-http';
import {
  getDb,
  RegistryService,
  DashboardService,
  IndicatorsService,
  AlertsService,
} from '@market-health/api-core';

let app: express.Express | null = null;

async function getApp(): Promise<express.Express> {
  if (app) return app;

  const db = await getDb();
  const registry = new RegistryService();
  const dashboardService = new DashboardService(
    db.getSnapshotRepo(),
    db.getPointsRepo(),
    db.getScoreRepo(),
    registry,
  );
  const indicatorsService = new IndicatorsService(
    db.getPointsRepo(),
    db.getDerivedRepo(),
    db.getScoreRepo(),
  );
  const alertsService = new AlertsService(db.getRuleRepo(), db.getFiredRepo());

  app = express();
  app.use(express.json());

  app.get('/api/dashboard/today', async (req: Request, res: Response) => {
    try {
      const timezone = (req.query.timezone as string) || 'America/Santo_Domingo';
      const data = await dashboardService.getToday(timezone);
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.get('/api/indicators/:key/history', async (req: Request, res: Response) => {
    try {
      const key = req.params.key;
      const range = (req.query.range as string) || '30d';
      const granularity = (req.query.granularity as string) || '1d';
      const data = await indicatorsService.getHistory(key, range, granularity);
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.get('/api/score/history', async (req: Request, res: Response) => {
    try {
      const range = (req.query.range as string) || '12w';
      const data = await indicatorsService.getScoreHistory(range);
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.get('/api/alerts/history', async (req: Request, res: Response) => {
    try {
      const range = (req.query.range as string) || '30d';
      const data = await alertsService.getHistory(range);
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.get('/api/rules', async (_req: Request, res: Response) => {
    try {
      const data = await alertsService.listRules();
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.get('/api/rules/:id', async (req: Request, res: Response) => {
    try {
      const rule = await alertsService.getRule(req.params.id);
      if (!rule) return res.status(404).json({ error: 'Not found' });
      res.json(rule);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.post('/api/rules', async (req: Request, res: Response) => {
    try {
      const { json_rule } = req.body || {};
      if (!json_rule) return res.status(400).json({ error: 'json_rule required' });
      const data = await alertsService.createRule(json_rule);
      res.status(201).json(data);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.patch('/api/rules/:id', async (req: Request, res: Response) => {
    try {
      const body = req.body || {};
      const data = await alertsService.updateRule(req.params.id, body);
      if (!data) return res.status(404).json({ error: 'Not found' });
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  app.delete('/api/rules/:id', async (req: Request, res: Response) => {
    try {
      const ok = await alertsService.deleteRule(req.params.id);
      res.json({ deleted: ok });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });

  return app;
}

let serverlessHandler: ReturnType<typeof serverless> | null = null;

export const handler = async (event: unknown, context: unknown) => {
  const expressApp = await getApp();
  if (!serverlessHandler) serverlessHandler = serverless(expressApp, { binary: false });
  return serverlessHandler(event, context);
};
