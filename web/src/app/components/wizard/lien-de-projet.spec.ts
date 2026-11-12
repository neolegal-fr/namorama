import { describe, expect, it } from 'vitest';
import { issueDuLienDeProjet } from './lien-de-projet';

/** Chantier `lien-de-projet-sans-session`, tâche 1.1. */
describe('issueDuLienDeProjet', () => {
  it('envoie un visiteur sans session vers la connexion, avant tout appel', () => {
    expect(issueDuLienDeProjet({ connecte: false })).toBe('connexion');
  });

  it('charge le projet quand la session existe', () => {
    expect(issueDuLienDeProjet({ connecte: true })).toBe('charger');
  });

  it('dit « introuvable » sur un 404, projet inexistant ou non partagé', () => {
    expect(issueDuLienDeProjet({ connecte: true, statut: 404 })).toBe('introuvable');
  });

  it('renvoie vers la connexion sur un 401 : la session a expiré', () => {
    expect(issueDuLienDeProjet({ connecte: true, statut: 401 })).toBe('connexion');
  });

  it('dit « échec » sur une erreur du serveur ou du réseau', () => {
    expect(issueDuLienDeProjet({ connecte: true, statut: 500 })).toBe('echec');
    expect(issueDuLienDeProjet({ connecte: true, statut: 0 })).toBe('echec');
  });
});
