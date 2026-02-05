import { Injectable } from '@nestjs/common';
import { RegistryService } from '../indicators/registry.service';
import { ProviderAdapter } from './adapter.interface';
import { FredAdapter } from './fred.adapter';
import { BinanceAdapter } from './binance.adapter';
import { AlternativeMeAdapter } from './alternative-me.adapter';
import { TwelveDataAdapter } from './twelve-data.adapter';

@Injectable()
export class ProviderFactory {
  private adapters: ProviderAdapter[];

  constructor(
    private readonly registry: RegistryService,
    private readonly fredAdapter: FredAdapter,
    private readonly binanceAdapter: BinanceAdapter,
    private readonly alternativeMeAdapter: AlternativeMeAdapter,
    private readonly twelveDataAdapter: TwelveDataAdapter,
  ) {
    this.adapters = [
      this.fredAdapter,
      this.binanceAdapter,
      this.alternativeMeAdapter,
      this.twelveDataAdapter,
    ];
  }

  getAdapter(indicatorKey: string): ProviderAdapter | null {
    const config = this.registry.getByKey(indicatorKey);
    if (!config) return null;
    return this.adapters.find((a) => a.supports.includes(indicatorKey)) ?? null;
  }
}
