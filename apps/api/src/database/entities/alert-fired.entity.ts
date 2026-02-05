import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('alerts_fired')
@Index(['rule_id', 'ts'])
export class AlertFired {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  rule_id: string;

  @Column({ type: 'timestamptz' })
  ts: Date;

  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, unknown> | null;

  @Column({ nullable: true })
  dedupe_key: string | null;
}
