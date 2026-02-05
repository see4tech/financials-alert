import { RegistryService } from '../registry';
import { ProviderAdapter } from './adapter.interface';
import { FredAdapter } from './fred.adapter';
import { CoinGeckoAdapter } from './coingecko.adapter';
import { BinanceAdapter } from './binance.adapter';
import { AlternativeMeAdapter } from './alternative-me.adapter';
import { TwelveDataAdapter } from './twelve-data.adapter';

export class ProviderFactory {
  private adapters: ProviderAdapter[];
  private registry: RegistryService;

  constructor(registry: RegistryService) {
    this.registry = registry;
    this.adapters = [
      new FredAdapter(),
      new CoinGeckoAdapter(),
      new BinanceAdapter(),
      new AlternativeMeAdapter(),
      new TwelveDataAdapter(),
    ];
  }

  getAdapter(indicatorKey: string): ProviderAdapter | null {
    const config = this.registry.getByKey(indicatorKey);
    if (!config) return null;
    return this.adapters.find((a) => a.supports.includes(indicatorKey)) ?? null;
  }
}
