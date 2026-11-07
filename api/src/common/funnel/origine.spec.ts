import {
  canalDe, cheminDArrivee, domaineReferent, domainesDuProduit, origineDeLaVisite, parametreDeCampagne,
} from './origine';

/**
 * Origine d'une visite et canal d'acquisition.
 *
 * Chaque bloc reprend un scénario de
 * `openspec/changes/mesurer-les-canaux-d-acquisition/specs/canaux-d-acquisition/spec.md`.
 */
describe('Origine d’une visite', () => {
  const PRODUIT = ['namorama.com', 'auth.namorama.com', 'localhost'];

  describe('page d’arrivée', () => {
    it('retire paramètres et fragment', () => {
      expect(cheminDArrivee('/app?rapport=filmoryx')).toBe('/app');
      expect(cheminDArrivee('/generateur-nom-de-marque?utm_source=chatgpt.com#haut')).toBe('/generateur-nom-de-marque');
    });

    it('remplace un identifiant par :id', () => {
      expect(cheminDArrivee('/projects/03c3d48d-cad6-4690-989f-499d0973e110')).toBe('/projects/:id');
      expect(cheminDArrivee('/rapport/12345')).toBe('/rapport/:id');
    });

    it('garde la racine et les chemins ordinaires', () => {
      expect(cheminDArrivee('/')).toBe('/');
      expect(cheminDArrivee('/en')).toBe('/en');
      expect(cheminDArrivee('/guides/trouver-nom-de-marque/')).toBe('/guides/trouver-nom-de-marque');
    });

    it('rejette ce qui n’est pas un chemin', () => {
      expect(cheminDArrivee('https://namorama.com/app')).toBeNull();
      expect(cheminDArrivee('/a/<script>')).toBeNull();
      expect(cheminDArrivee(42)).toBeNull();
      expect(cheminDArrivee('')).toBeNull();
    });

    it('borne la longueur à 120 caractères', () => {
      // `z` : une suite de `a` aurait la forme d'un identifiant hexadécimal, réduit à `:id`.
      expect(cheminDArrivee('/' + 'z'.repeat(300))!.length).toBe(120);
    });
  });

  describe('paramètres de campagne', () => {
    it('passe en minuscules et retire les espaces de bordure', () => {
      expect(parametreDeCampagne('  ChatGPT.com ')).toBe('chatgpt.com');
    });

    it('rejette une valeur suspecte sans rejeter la visite', () => {
      expect(parametreDeCampagne('<script>')).toBeNull();
      expect(parametreDeCampagne('a b')).toBeNull();
      const o = origineDeLaVisite({ arrivee: '/', utmCampaign: '<script>', utmSource: 'newsletter' }, PRODUIT);
      expect(o.utmCampaign).toBeNull();
      expect(o.utmSource).toBe('newsletter');
      expect(o.landingPath).toBe('/');
    });

    it('tronque à 60 caractères', () => {
      expect(parametreDeCampagne('x'.repeat(100))!.length).toBe(60);
    });
  });

  describe('référent', () => {
    it('réduit à son domaine, sans www', () => {
      expect(domaineReferent('www.google.fr', PRODUIT)).toBe('google.fr');
      expect(domaineReferent('https://www.google.fr/', PRODUIT)).toBe('google.fr');
    });

    it('ne garde jamais le chemin ni les paramètres', () => {
      expect(domaineReferent('https://mail.example.com/inbox?user=jean.dupont', PRODUIT)).toBe('mail.example.com');
    });

    it('ignore une navigation interne, authentification comprise', () => {
      expect(domaineReferent('namorama.com', PRODUIT)).toBeNull();
      expect(domaineReferent('www.namorama.com', PRODUIT)).toBeNull();
      expect(domaineReferent('auth.namorama.com', PRODUIT)).toBeNull();
      expect(domaineReferent('localhost', PRODUIT)).toBeNull();
    });

    it('rejette ce qui n’est pas un domaine', () => {
      expect(domaineReferent('pas un domaine', PRODUIT)).toBeNull();
      expect(domaineReferent('android-app://com.google.android.gm', PRODUIT)).toBeNull();
    });
  });

  describe('domaines du produit', () => {
    it('ajoute ceux de la configuration à namorama.com', () => {
      expect(domainesDuProduit({ FRONTEND_URL: 'https://app.exemple.fr', KEYCLOAK_AUTH_SERVER_URL: 'https://auth.exemple.fr/' } as any))
        .toEqual(['namorama.com', 'app.exemple.fr', 'auth.exemple.fr']);
    });

    it('ignore une variable mal formée', () => {
      expect(domainesDuProduit({ FRONTEND_URL: 'pas une url' } as any)).toEqual(['namorama.com']);
    });
  });

  describe('canal', () => {
    const canal = (utmSource: string | null, referrerHost: string | null) => canalDe({ utmSource, referrerHost });

    it('lien partagé par ChatGPT', () => {
      expect(canal('chatgpt.com', null)).toBe('ia');
      expect(canal('chatgpt', null)).toBe('ia');
      expect(canal(null, 'chatgpt.com')).toBe('ia');
      expect(canal(null, 'perplexity.ai')).toBe('ia');
    });

    it('la source de campagne prime sur le référent', () => {
      expect(canal('chatgpt.com', 'google.com')).toBe('ia');
    });

    it('un assistant de Google n’est pas une recherche Google', () => {
      expect(canal(null, 'gemini.google.com')).toBe('ia');
    });

    it('moteurs, quel que soit le pays', () => {
      expect(canal(null, 'google.fr')).toBe('moteurs');
      expect(canal(null, 'google.co.uk')).toBe('moteurs');
      expect(canal(null, 'bing.com')).toBe('moteurs');
      expect(canal(null, 'duckduckgo.com')).toBe('moteurs');
      expect(canal('google', null)).toBe('moteurs');
    });

    it('une messagerie n’est pas un moteur', () => {
      expect(canal(null, 'mail.google.com')).toBe('autres');
      expect(canal(null, 'mail.yahoo.com')).toBe('autres');
    });

    it('réseaux sociaux', () => {
      expect(canal(null, 'l.facebook.com')).toBe('reseaux');
      expect(canal(null, 'linkedin.com')).toBe('reseaux');
      expect(canal(null, 't.co')).toBe('reseaux');
      expect(canal(null, 'fr.pinterest.com')).toBe('reseaux');
      expect(canal('linkedin', null)).toBe('reseaux');
    });

    it('un référent inconnu du classement compte dans « autres sites »', () => {
      expect(canal(null, 'forum-entrepreneurs.fr')).toBe('autres');
      expect(canal('newsletter', null)).toBe('autres');
    });

    it('un libellé générique ne passe pas pour un assistant', () => {
      expect(canal('chat', null)).toBe('autres');
    });

    it('ni source ni référent : direct ou inconnu', () => {
      expect(canal(null, null)).toBe('direct');
    });
  });

  it('une origine absente donne une visite sans origine', () => {
    expect(origineDeLaVisite(undefined, PRODUIT)).toEqual({
      landingPath: null, utmSource: null, utmMedium: null, utmCampaign: null, referrerHost: null,
    });
  });
});
