import { Entity, PrimaryColumn, Column, Index } from 'typeorm';

@Entity('indicator_points')
@Index(['indicator_key', 'ts'])
export class IndicatorPoint {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' })
  id: string;

  @PrimaryColumn({ type: 'timestamptz' })
  ts: Date;

  @Column()
  indicator_key: string;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  value: number;

  @Column({ length: 10 })
  granularity: string;

  @Column({ length: 20, default: 'ok' })
  quality_flag: string;
}
