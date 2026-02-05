import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('indicators')
export class Indicator {
  @PrimaryColumn()
  key: string;

  @Column()
  name: string;

  @Column()
  category: string;

  @Column({ default: '' })
  unit: string;

  @Column({ type: 'int', default: 3600 })
  poll_interval_sec: number;

  @Column({ default: true })
  enabled: boolean;
}
