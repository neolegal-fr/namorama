import { FunnelService } from './funnel.service';
import { EventsController } from '../../events/events.controller';

/**
 * L'origine d'une visite : écrite une fois, par le premier affichage, et
 * journalisée nettoyée.
 *
 * Scénarios « Origine fixée à la première page » et « Aucune donnée
 * identifiante » de `specs/canaux-d-acquisition/spec.md`.
 */
describe('Origine d’une visite — écriture', () => {
  const SESSION = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

  function service() {
    const query = jest.fn().mockResolvedValue(undefined);
    return { funnel: new FunnelService({ query } as any), query };
  }

  describe('FunnelService', () => {
    it('écrit l’origine à l’insertion et jamais à la mise à jour', async () => {
      const { funnel, query } = service();
      await funnel.visite(SESSION, false, {
        landingPath: '/generateur-nom-de-marque', utmSource: 'chatgpt.com',
        utmMedium: null, utmCampaign: null, referrerHost: null,
      });
      const [sql, params] = query.mock.calls[0];
      expect(sql).toContain('landingPath, utmSource, utmMedium, utmCampaign, referrerHost');
      // La clause de doublon ne touche à rien : la première page fait foi.
      const miseAJour = sql.split('ON DUPLICATE KEY UPDATE')[1];
      expect(miseAJour.trim()).toBe('sessionId = sessionId');
      expect(params).toEqual([SESSION, 0, '/generateur-nom-de-marque', 'chatgpt.com', null, null, null]);
    });

    it('une étape sans affichage reçu crée la visite sans origine', async () => {
      const { funnel, query } = service();
      await funnel.marquer(SESSION, 'recherche', 'sub-1');
      const [sql] = query.mock.calls[0];
      expect(sql).not.toMatch(/landingPath|utmSource|referrerHost/);
    });

    it('sans origine fournie, écrit des NULL', async () => {
      const { funnel, query } = service();
      await funnel.visite(SESSION, true);
      expect(query.mock.calls[0][1]).toEqual([SESSION, 1, null, null, null, null, null]);
    });
  });

  describe('EventsController', () => {
    function controleur() {
      const visite = jest.fn().mockResolvedValue(undefined);
      const event = jest.fn();
      const c = new EventsController({ event } as any, { visite, marquer: jest.fn() } as any);
      return { c, visite, event };
    }

    it('transmet l’origine nettoyée, et la journalise sous cette forme seulement', async () => {
      const { c, visite, event } = controleur();
      await c.track(
        {
          name: 'page_viewed',
          sessionId: SESSION,
          meta: {
            path: '/generateur-nom-de-marque', connecte: false,
            arrivee: '/generateur-nom-de-marque?utm_source=chatgpt.com',
            utmSource: 'ChatGPT.com', utmCampaign: '<script>',
            referent: 'https://mail.example.com/inbox?user=jean.dupont',
          },
        } as any,
        { headers: {} } as any,
      );

      expect(visite).toHaveBeenCalledWith(SESSION, false, {
        landingPath: '/generateur-nom-de-marque', utmSource: 'chatgpt.com',
        utmMedium: null, utmCampaign: null, referrerHost: 'mail.example.com',
      });

      const [, journal] = event.mock.calls[0];
      expect(journal).toMatchObject({
        landingPath: '/generateur-nom-de-marque', utmSource: 'chatgpt.com', referrerHost: 'mail.example.com',
      });
      // Ni la valeur rejetée, ni l'adresse complète du référent, ni les clés brutes.
      const texte = JSON.stringify(journal);
      expect(texte).not.toContain('<script>');
      expect(texte).not.toContain('jean.dupont');
      expect(journal).not.toHaveProperty('referent');
      expect(journal).not.toHaveProperty('arrivee');
    });

    it('un autre événement ne crée pas de visite et garde ses clés', async () => {
      const { c, visite, event } = controleur();
      await c.track({ name: 'wizard_step_viewed', sessionId: SESSION, meta: { step: 2 } } as any, { headers: {} } as any);
      expect(visite).not.toHaveBeenCalled();
      expect(event.mock.calls[0][1]).toMatchObject({ step: 2 });
    });
  });
});
