import { MailService } from './mail.service';

/**
 * `send` transmet à nodemailer ce qu'on lui donne, en-têtes compris : la
 * désinscription en un clic des demandes de retour automatiques en dépend.
 */
describe('MailService.send', () => {
  function service() {
    const svc = Object.create(MailService.prototype) as any;
    svc.config = { get: (_k: string, defaut?: string) => defaut };
    svc.logger = { error: jest.fn(), log: jest.fn(), warn: jest.fn() };
    svc.transporter = { sendMail: jest.fn().mockResolvedValue({}) };
    return svc;
  }

  it('transmet les en-têtes List-Unsubscribe', async () => {
    const svc = service();
    const headers = {
      'List-Unsubscribe': '<https://api.namorama.com/retours/desinscription?j=abc>',
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    };
    await expect(svc.send({ to: 'a@b.c', subject: 's', html: '<p>x</p>', fromName: 'Namorama', headers })).resolves.toBe(true);
    expect(svc.transporter.sendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'a@b.c',
      headers,
      from: { name: 'Namorama', address: 'support@namorama.com' },
    }));
  });

  it('sans en-têtes, n\'en invente pas', async () => {
    const svc = service();
    await svc.send({ to: 'a@b.c', subject: 's', html: 'x' });
    expect(svc.transporter.sendMail.mock.calls[0][0].headers).toBeUndefined();
  });

  it('ne lève jamais : un refus SMTP rend false', async () => {
    const svc = service();
    svc.transporter.sendMail.mockRejectedValue(new Error('550'));
    await expect(svc.send({ to: 'a@b.c', subject: 's', html: 'x' })).resolves.toBe(false);
  });
});
