import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('alert_rules')
export class AlertRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  user_id: string | null;

  @Column({ type: 'jsonb' })
  json_rule: Record<string, unknown>;

  @Column({ default: true })
  is_enabled: boolean;
}
