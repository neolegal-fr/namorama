import { CONSIGNE_REFORMULATION, DomainService } from './domain.service';
import { modeleOpenAiFactice } from '../common/modele-ia/modele-ia.testing';

/**
 * Chantier `reformulation-systematique` : la reformulation est proposée à
 * chaque passage à l'étape 2. Elle doit garder le cahier des charges du nom,
 * la langue et les faits de la description — sans quoi la généraliser
 * réécrirait tous les briefs.
 */
function service(contenu: string) {
  const appels: any[] = [];
  const modele = modeleOpenAiFactice(async (p) => {
    appels.push(p);
    return { choices: [{ message: { content: contenu } }] };
  });
  return { svc: new DomainService({} as any, {} as any, modele), appels };
}

describe('reformulation de la description', () => {
  it('envoie la consigne de reformulation en message système, la description en message utilisateur', async () => {
    const { svc, appels } = service('Une version claire.');
    await svc.refineDescription('Application de méditation pour soignants, nom de 4-5 lettres');
    expect(appels[0].messages).toEqual([
      { role: 'system', content: CONSIGNE_REFORMULATION },
      { role: 'user', content: 'Application de méditation pour soignants, nom de 4-5 lettres' },
    ]);
  });

  it('la consigne impose la langue de la description', () => {
    expect(CONSIGNE_REFORMULATION).toMatch(/SAME LANGUAGE/);
  });

  it("la consigne interdit d'ajouter un fait absent de la description", () => {
    expect(CONSIGNE_REFORMULATION).toMatch(/NEVER add a feature, an audience/);
    expect(CONSIGNE_REFORMULATION).not.toMatch(/compl[eè]te/i);
  });

  it('la consigne fait recopier chaque instruction portant sur le nom', () => {
    for (const motif of [/length or number of letters/, /forbidden endings/, /must contain/, /reference brands/, /invented vs descriptive/]) {
      expect(CONSIGNE_REFORMULATION).toMatch(motif);
    }
  });

  it('retire le Markdown que le modèle ajouterait malgré la consigne', async () => {
    const { svc } = service('## Titre\n**Une** application.\n- point');
    await expect(svc.refineDescription('desc assez longue')).resolves.toBe('Titre\nUne application.\npoint');
  });

  it("rend la description d'origine quand la réponse est vide", async () => {
    const { svc } = service('   ');
    await expect(svc.refineDescription('desc assez longue')).resolves.toBe('desc assez longue');
  });
});
