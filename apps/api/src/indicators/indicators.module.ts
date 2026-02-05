import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Indicator } from '../database/entities';
import { RegistryService } from './registry.service';
import { StatusEngine } from './status-engine';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Indicator])],
  providers: [RegistryService, StatusEngine],
  exports: [RegistryService, StatusEngine, TypeOrmModule],
})
export class IndicatorsModule {}
