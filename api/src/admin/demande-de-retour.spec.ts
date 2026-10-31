import { DemandeDeRetourService, LOT_MAX } from './demande-de-retour.service';
import { AdminMailService } from './admin-mail.service';

/**
 * Chantier `demande-de-retour-automatique` : la demande part seule, une fois
 * par compte, sans modèle. La sélection SQL des éligibles se vérifie sur une
 * vraie base (tâche 4.3) ; ici, ce que le service fait des comptes qu'on lui donne.
 */
const CONFIG: Record<string, string> = {
  FEEDBACK_SIGNATAIRE: 'Nicolas Riousset',
  FEEDBACK_LINK_SECRET: 'secret-de-test',
  FEEDBACK_AUTO_DEPUIS: '2026-11-01',
  FRONTEND_URL: 'https://namorama.com',
  API_PUBLIC_URL: 'https://api.namorama.com',
};

function fabrique(opts: { config?: Record<string, string>; reserve?: number; delivre?: boolean; comptes?: any[] } = {}) {
  const config = { get: (k: string, defaut?: string) => (opts.config ?? CONFIG)[k] ?? defaut } as any;
  const mailsEnregistres: any[] = [];
  const mails = { create: (d: any) => d, save: jest.fn(async (d: any) => { mailsEnregistres.push(d); return d; }) } as any;
  const execute = jest.fn().mockResolvedValue({ affected: opts.reserve ?? 1 });
  const users = {
    createQueryBuilder: () => ({ update: () => ({ set: () => ({ where: () => ({ execute }) }) }) }),
  } as any;
  const mail = { send: jest.fn().mockResolvedValue(opts.delivre ?? true) } as any;
  const events = { event: jest.fn() } as any;
  const adminMail = Object.create(AdminMailService.prototype) as AdminMailService;
  (adminMail as any).config = config;
  const svc = new DemandeDeRetourService(mails, users, {} as any, mail, adminMail, events, config);
  jest.spyOn(svc, 'eligibles').mockResolvedValue(opts.comptes ?? []);
  return { svc, mail, mails, mailsEnregistres, events, execute };
}

const lea = { id: 7, keycloakId: 'sub-lea', email: 'lea@example.com', firstName: 'Léa', locale: null, langueInscription: 'de' } as any;

describe('demande de retour automatique : envoi', () => {
  it('compose sans modèle, dans la langue d\'inscription, avec liens signés et désinscription', async () => {
    const { svc, mail, mailsEnregistres, events } = fabrique();
    await expect(svc.envoyer(lea)).resolves.toBe('envoye');
    const envoi = mail.send.mock.calls[0][0];
    expect(envoi.to).toBe('lea@example.com');
    expect(envoi.subject).toMatch(/Namorama/);
    expect(envoi.text).toMatch(/^Hallo Léa,/);
    expect(envoi.text).toContain('gestern');
    expect(envoi.text).toMatch(/https:\/\/namorama\.com\/retour\?j=/);
    expect(envoi.text).toMatch(/https:\/\/namorama\.com\/desinscription\?j=/);
    expect(envoi.text).toContain('Nicolas Riousset');
    expect(envoi.headers['List-Unsubscribe']).toMatch(/^<https:\/\/api\.namorama\.com\/retours\/desinscription\?j=.+>$/);
    expect(envoi.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    expect(mailsEnregistres[0]).toMatchObject({ userId: 7, adminSub: null, automatique: true, aiDrafted: false, delivered: true });
    expect(events.event).toHaveBeenCalledWith('feedback_request_sent', { userId: 'sub-lea', delivered: true, langue: 'de' });
    expect(JSON.stringify(events.event.mock.calls)).not.toContain('lea@example.com');
  });

  it('langue inconnue : français', async () => {
    const { svc, mail } = fabrique();
    await svc.envoyer({ ...lea, langueInscription: null });
    expect(mail.send.mock.calls[0][0].text).toMatch(/^Bonjour Léa,/);
  });

  it('réservation déjà prise par un autre passage : aucun envoi', async () => {
    const { svc, mail, mails } = fabrique({ reserve: 0 });
    await expect(svc.envoyer(lea)).resolves.toBe('deja');
    expect(mail.send).not.toHaveBeenCalled();
    expect(mails.save).not.toHaveBeenCalled();
  });

  it('refus SMTP : noté non délivré, journalisé, et la réservation reste posée (pas de nouvel essai)', async () => {
    const { svc, mailsEnregistres, events, execute } = fabrique({ delivre: false });
    await expect(svc.envoyer(lea)).resolves.toBe('echec');
    expect(mailsEnregistres[0].delivered).toBe(false);
    expect(events.event).toHaveBeenCalledWith('feedback_request_sent', expect.objectContaining({ delivered: false }));
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('n\'a pas de modèle à appeler : le service ne dépend pas de ModeleIA', () => {
    expect(DemandeDeRetourService.length).toBe(7);
    const { svc } = fabrique();
    expect(Object.values(svc).some((v: any) => v?.constructor?.name === 'ModeleIA')).toBe(false);
  });
});

describe('demande de retour automatique : passages', () => {
  it('un passage envoie à chaque éligible et journalise son bilan', async () => {
    const { svc, events } = fabrique({ comptes: [lea, { ...lea, id: 8, keycloakId: 'sub-8' }] });
    await expect(svc.passage()).resolves.toEqual({ eligibles: 2, envoyes: 2, echecs: 0 });
    expect(events.event).toHaveBeenCalledWith('demande_retour_passage', { eligibles: 2, envoyes: 2, echecs: 0 });
  });

  it('deux passages simultanés : un seul s\'exécute', async () => {
    const { svc, mail } = fabrique({ comptes: [lea] });
    const [a, b] = await Promise.all([svc.passage(), svc.passage()]);
    expect(a.envoyes + b.envoyes).toBe(1);
    expect(mail.send).toHaveBeenCalledTimes(1);
  });

  it('configuration incomplète : aucune minuterie, aucun envoi, et la variable manquante est nommée', async () => {
    const { svc, mail } = fabrique({ config: { FEEDBACK_SIGNATAIRE: 'Nicolas Riousset', FEEDBACK_LINK_SECRET: 's' }, comptes: [lea] });
    expect(svc.configurationManquante()).toEqual(['FEEDBACK_AUTO_DEPUIS']);
    const warn = jest.spyOn((svc as any).logger, 'warn').mockImplementation(() => undefined);
    svc.onModuleInit();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('FEEDBACK_AUTO_DEPUIS'));
    expect((svc as any).minuterie).toBeUndefined();
    await expect(svc.passage()).resolves.toEqual({ eligibles: 0, envoyes: 0, echecs: 0 });
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('la sélection est bornée à un lot', () => {
    expect(LOT_MAX).toBe(20);
  });
});
