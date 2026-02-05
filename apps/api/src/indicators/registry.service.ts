import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface IndicatorConfig {
  key: string;
  name: string;
  category: string;
  unit: string;
  poll_interval_sec: number;
  enabled: boolean;
  trend_window_days: number;
  epsilon: number;
  constituents?: string[];
  zones?: { support_low: number; support_high: number; bear_line: number; bull_confirm: number };
}


interface RegistryFile {
  indicators: IndicatorConfig[];
}

@Injectable()
export class RegistryService {
  private config: IndicatorConfig[] = [];

  constructor() {
    this.load();
  }

  private load(): void {
    const candidates = [
      path.join(__dirname, 'registry.json'),
      process.env.REGISTRY_PATH || '',
      path.join(process.cwd(), 'apps', 'api', 'src', 'indicators', 'registry.json'),
      path.join(process.cwd(), 'netlify', 'functions', 'registry.json'),
    ].filter(Boolean);
    for (const p of candidates) {
      try {
        const raw = fs.readFileSync(p, 'utf-8');
        const data: RegistryFile = JSON.parse(raw);
        this.config = data.indicators;
        return;
      } catch {
        continue;
      }
    }
    throw new Error('Could not load registry.json from any candidate path');
  }

  getAll(): IndicatorConfig[] {
    return [...this.config];
  }

  getEnabled(): IndicatorConfig[] {
    return this.config.filter((i) => i.enabled);
  }

  getByKey(key: string): IndicatorConfig | undefined {
    return this.config.find((i) => i.key === key);
  }

  getCoreKeys(): string[] {
    return [
      'macro.us10y',
      'macro.dxy',
      'eq.nasdaq',
      'eq.leaders',
      'crypto.btc',
      'sent.fng',
      'crypto.etf_flows',
      'crypto.liquidations',
    ];
  }
}
