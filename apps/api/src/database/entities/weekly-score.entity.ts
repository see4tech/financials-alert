import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('weekly_scores')
@Index(['week_start_date'])
export class WeeklyScore {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date' })
  week_start_date: string;

  @Column({ type: 'uuid', nullable: true })
  user_id: string | null;

  @Column({ type: 'int' })
  score: number;

  @Column({ type: 'int', nullable: true })
  delta_score: number | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;
}
