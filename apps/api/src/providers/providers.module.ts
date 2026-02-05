import { Module } from '@nestjs/common';
import { ProviderFactory } from './provider.factory';
import { FredAdapter } from './fred.adapter';
import { BinanceAdapter } from './binance.adapter';
import { AlternativeMeAdapter } from './alternative-me.adapter';
import { TwelveDataAdapter } from './twelve-data.adapter';

@Module({
  providers: [ProviderFactory, FredAdapter, BinanceAdapter, AlternativeMeAdapter, TwelveDataAdapter],
  exports: [ProviderFactory],
})
export class ProvidersModule {}
