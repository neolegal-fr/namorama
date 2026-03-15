import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

const REWARD_COPY: Record<string, {
  subject: string;
  greeting: (name: string) => string;
  body: (credits: number, total: number) => string;
  cta: string;
  sign: string;
}> = {
  fr: {
    subject: '🎉 Merci pour votre feedback — vos crédits sont arrivés !',
    greeting: (name) => `Bonjour ${name},`,
    body: (credits, total) =>
      `Nous avons bien reçu votre retour et nous vous en remercions sincèrement.<br><br>` +
      `En récompense, nous avons crédité votre compte de <strong>${credits} crédits</strong>.<br>` +
      `Votre solde total est maintenant de <strong>${total} crédits</strong>.`,
    cta: 'Utiliser mes crédits sur Namorama →',
    sign: `À très bientôt sur Namorama !<br>L'équipe Namorama`,
  },
  en: {
    subject: '🎉 Thank you for your feedback — your credits are here!',
    greeting: (name) => `Hi ${name},`,
    body: (credits, total) =>
      `We received your feedback and we truly appreciate it.<br><br>` +
      `As a reward, we've added <strong>${credits} credits</strong> to your account.<br>` +
      `Your total balance is now <strong>${total} credits</strong>.`,
    cta: 'Use my credits on Namorama →',
    sign: `See you soon on Namorama!<br>The Namorama team`,
  },
  de: {
    subject: '🎉 Vielen Dank für Ihr Feedback — Ihre Credits sind da!',
    greeting: (name) => `Hallo ${name},`,
    body: (credits, total) =>
      `Wir haben Ihr Feedback erhalten und danken Ihnen herzlich dafür.<br><br>` +
      `Als Dankeschön haben wir Ihrem Konto <strong>${credits} Credits</strong> gutgeschrieben.<br>` +
      `Ihr aktuelles Guthaben beträgt <strong>${total} Credits</strong>.`,
    cta: 'Meine Credits auf Namorama nutzen →',
    sign: `Bis bald auf Namorama!<br>Das Namorama-Team`,
  },
  es: {
    subject: '🎉 ¡Gracias por tu opinión — tus créditos ya están aquí!',
    greeting: (name) => `Hola ${name},`,
    body: (credits, total) =>
      `Hemos recibido tu opinión y te lo agradecemos sinceramente.<br><br>` +
      `Como recompensa, hemos añadido <strong>${credits} créditos</strong> a tu cuenta.<br>` +
      `Tu saldo total es ahora de <strong>${total} créditos</strong>.`,
    cta: 'Usar mis créditos en Namorama →',
    sign: `¡Hasta pronto en Namorama!<br>El equipo de Namorama`,
  },
  pt: {
    subject: '🎉 Obrigado pelo seu feedback — seus créditos chegaram!',
    greeting: (name) => `Olá ${name},`,
    body: (credits, total) =>
      `Recebemos o seu feedback e agradecemos sinceramente.<br><br>` +
      `Como recompensa, adicionamos <strong>${credits} créditos</strong> à sua conta.<br>` +
      `O seu saldo total é agora de <strong>${total} créditos</strong>.`,
    cta: 'Usar meus créditos no Namorama →',
    sign: `Até breve no Namorama!<br>A equipa Namorama`,
  },
  it: {
    subject: '🎉 Grazie per il tuo feedback — i tuoi crediti sono arrivati!',
    greeting: (name) => `Ciao ${name},`,
    body: (credits, total) =>
      `Abbiamo ricevuto il tuo feedback e te ne siamo davvero grati.<br><br>` +
      `Come ricompensa, abbiamo aggiunto <strong>${credits} crediti</strong> al tuo account.<br>` +
      `Il tuo saldo totale è ora di <strong>${total} crediti</strong>.`,
    cta: 'Usa i miei crediti su Namorama →',
    sign: `A presto su Namorama!<br>Il team Namorama`,
  },
  nl: {
    subject: '🎉 Bedankt voor je feedback — je credits zijn er!',
    greeting: (name) => `Hallo ${name},`,
    body: (credits, total) =>
      `We hebben je feedback ontvangen en zijn je er oprecht dankbaar voor.<br><br>` +
      `Als beloning hebben we <strong>${credits} credits</strong> aan je account toegevoegd.<br>` +
      `Je totale saldo is nu <strong>${total} credits</strong>.`,
    cta: 'Mijn credits gebruiken op Namorama →',
    sign: `Tot snel op Namorama!<br>Het Namorama-team`,
  },
};

function getCopy(locale: string | null | undefined) {
  if (!locale) return REWARD_COPY['en'];
  const lang = locale.split('-')[0].toLowerCase();
  return REWARD_COPY[lang] ?? REWARD_COPY['en'];
}

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

  async sendRewardEmail(params: {
    to: string;
    firstName: string | null;
    locale: string | null;
    creditsAwarded: number;
    totalCredits: number;
  }): Promise<void> {
    const from = this.config.get<string>('SMTP_FROM', 'support@namorama.com');
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'https://namorama.com');
    const copy = getCopy(params.locale);
    const name = params.firstName || 'there';

    const html = `
      <!DOCTYPE html>
      <html>
      <body style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 16px;color:#1a1a1a">
        <img src="${frontendUrl}/assets/logo.png" alt="Namorama" style="height:36px;margin-bottom:24px" />
        <p>${copy.greeting(name)}</p>
        <p>${copy.body(params.creditsAwarded, params.totalCredits)}</p>
        <div style="margin:32px 0;text-align:center">
          <a href="${frontendUrl}"
             style="background:#6366f1;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-weight:600;display:inline-block">
            ${copy.cta}
          </a>
        </div>
        <p>${copy.sign}</p>
        <hr style="border:none;border-top:1px solid #eee;margin:32px 0" />
        <p style="color:#888;font-size:12px">
          Namorama · <a href="${frontendUrl}" style="color:#888">${frontendUrl}</a>
        </p>
      </body>
      </html>
    `;

    try {
      await this.transporter.sendMail({
        from,
        to: params.to,
        subject: copy.subject,
        html,
      });
    } catch (err) {
      this.logger.error('Failed to send reward email', err);
    }
  }
}
