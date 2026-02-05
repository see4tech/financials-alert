import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('status_snapshots')
@Index(['indicator_key', 'ts'])
export class StatusSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'timestamptz' })
  ts: Date;

  @Column()
  indicator_key: string;

  @Column({ length: 20 })
  status: string;

  @Column({ length: 20 })
  trend: string;

  @Column({ type: 'text', nullable: true })
  explanation: string | null;

  @Column({ type: 'jsonb', nullable: true })
  meta: Record<string, unknown> | null;
}
