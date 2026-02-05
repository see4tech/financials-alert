import { Entity, PrimaryColumn, Column, Index } from 'typeorm';

@Entity('derived_metrics')
@Index(['indicator_key', 'ts'])
export class DerivedMetric {
  @PrimaryColumn('uuid', { default: () => 'gen_random_uuid()' })
  id: string;

  @PrimaryColumn({ type: 'timestamptz' })
  ts: Date;

  @Column()
  indicator_key: string;

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  pct_1d: number | null;

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  pct_7d: number | null;

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  pct_14d: number | null;

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  pct_21d: number | null;

  @Column({ type: 'decimal', precision: 20, scale: 10, nullable: true })
  slope_14d: number | null;

  @Column({ type: 'decimal', precision: 20, scale: 10, nullable: true })
  slope_21d: number | null;

  @Column({ type: 'decimal', precision: 20, scale: 8, nullable: true })
  ma_21d: number | null;
}
