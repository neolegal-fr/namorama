import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>('SMTP_HOST', 'ssl0.ovh.net'),
      port: this.config.get<number>('SMTP_PORT', 465),
      secure: this.config.get<string>('SMTP_SECURE', 'true') !== 'false',
      auth: {
        user: this.config.get<string>('SMTP_USER', 'support@namorama.com'),
        pass: this.config.get<string>('SMTP_PASS', ''),
      },
    });
  }

  async sendFeedbackNotification(feedback: {
    message: string;
    email: string | null;
    keycloakId: string | null;
  }): Promise<void> {
    const to = this.config.get<string>('FEEDBACK_NOTIFY_EMAIL', 'support@namorama.com');
    const from = this.config.get<string>('SMTP_FROM', 'support@namorama.com');

    const userInfo = feedback.keycloakId
      ? `Utilisateur authentifié (ID: ${feedback.keycloakId})`
      : 'Anonyme';
    const emailLine = feedback.email ? `Email: ${feedback.email}` : 'Email: —';

    const html = `
      <h2>Nouveau feedback Namorama</h2>
      <p><strong>Utilisateur :</strong> ${userInfo}</p>
      <p><strong>${emailLine}</strong></p>
      <hr />
      <p><strong>Message :</strong></p>
      <blockquote>${feedback.message.replace(/\n/g, '<br>')}</blockquote>
      <hr />
      <p style="color:#888;font-size:12px">Gérez les feedbacks dans l'administration Namorama.</p>
    `;

    try {
      await this.transporter.sendMail({
        from,
        to,
        subject: '📬 Nouveau feedback Namorama',
        html,
      });
    } catch (err) {
      this.logger.error('Failed to send feedback notification email', err);
    }
  }
}
