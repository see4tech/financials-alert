import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('notification_deliveries')
export class NotificationDelivery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  alert_id: string;

  @Column({ length: 50 })
  channel: string;

  @Column({ length: 30 })
  status: string;

  @Column({ nullable: true })
  provider_msg_id: string | null;

  @Column({ type: 'timestamptz' })
  ts: Date;
}
