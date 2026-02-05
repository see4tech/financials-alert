import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AlertFired, NotificationDelivery } from '../database/entities';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(AlertFired) private readonly firedRepo: Repository<AlertFired>,
    @InjectRepository(NotificationDelivery) private readonly deliveryRepo: Repository<NotificationDelivery>,
  ) {}

  async send(alertId: string, payload: Record<string, unknown>, actions: string[] = ['email']): Promise<void> {
    const title = this.title(payload);
    const body = this.body(payload);
    const link = process.env.DASHBOARD_LINK || 'http://localhost:3001/dashboard';

    for (const channel of actions) {
      if (channel === 'email') {
        await this.sendEmail(title, body, link);
        await this.deliveryRepo.save({
          alert_id: alertId,
          channel: 'email',
          status: 'sent',
          provider_msg_id: null,
          ts: new Date(),
        });
      }
    }
  }

  private title(payload: Record<string, unknown>): string {
    const name = payload.ruleName as string;
    const indicatorKey = payload.indicatorKey as string;
    return `${name ?? 'Alert'}: ${indicatorKey ?? 'indicator'}`;
  }

  private body(payload: Record<string, unknown>): string {
    const parts: string[] = [];
    if (payload.value != null && payload.threshold != null) {
      parts.push(`Value: ${payload.value} (threshold: ${payload.threshold})`);
    }
    if (payload.previousTrend != null && payload.currentTrend != null) {
      parts.push(`Trend: ${payload.previousTrend} → ${payload.currentTrend}`);
    }
    parts.push('Why it matters: condition met. Check dashboard for details.');
    return parts.join('\n');
  }

  private async sendEmail(_title: string, _body: string, link: string): Promise<void> {
    const apiKey = process.env.SENDGRID_API_KEY;
    const from = process.env.SENDGRID_FROM_EMAIL || 'alerts@market-health.local';
    if (!apiKey) {
      console.warn('SENDGRID_API_KEY not set; skipping email');
      return;
    }
    try {
      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: process.env.ALERT_EMAIL || from }] }],
          from: { email: from, name: 'Market Health' },
          subject: _title,
          content: [{ type: 'text/plain', value: `${_body}\n\nDashboard: ${link}` }],
        }),
      });
      if (!res.ok) {
        console.warn('SendGrid error', res.status, await res.text());
      }
    } catch (err) {
      console.warn('SendGrid send failed', err);
    }
  }
}
