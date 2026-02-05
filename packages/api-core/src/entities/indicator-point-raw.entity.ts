import { Entity, PrimaryColumn, Column, Index } from 'typeorm';

@Entity('indicator_points_raw')
@Index(['indicator_key', 'ts'])
export class IndicatorPointRaw {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' })
  id: string;

  @PrimaryColumn({ type: 'timestamptz' })
  ts: Date;

  @Column()
  indicator_key: string;

  @Column({ type: 'decimal', precision: 20, scale: 8 })
  value: number;

  @Column({ default: 'unknown' })
  source: string;

  @Column({ type: 'jsonb', nullable: true })
  raw_json: Record<string, unknown> | null;
}
