import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ConfigService } from './config';
import type { ArticleMarkdown, SegmentArticle } from '../components/content/articles';

/** État affiché : un article publié dont la date n'est pas venue est « programmé ». */
export type EtatArticle = 'brouillon' | 'programme' | 'publie';

export interface ArticleRedaction extends ArticleMarkdown {
  id: number;
  etat: EtatArticle;
  /** A déjà été servi au public : son adresse est figée, il ne se supprime plus. */
  aParu: boolean;
  revision: number;
  majLe: string;
  majPar: string;
  source: string;
}

export interface RevisionArticle {
  numero: number;
  auteurType: 'compte' | 'jeton';
  auteurNom: string;
  creeLe: string;
}

export type VerificationArticle =
  | { ok: true; article: ArticleMarkdown & { segments: SegmentArticle[] } }
  | { ok: false; causes: string[] };

export interface JetonRedaction {
  id: number;
  nom: string;
  prefixe: string;
  portee: string;
  creeLe: string;
  derniereUtilisation: string | null;
  revoqueLe: string | null;
}

/**
 * Corps d'erreur de l'API de rédaction : `causes` d'un article refusé (400),
 * `revisionCourante` et `auteur` d'un conflit (409), `citants` d'une dépublication refusée.
 */
export interface ErreurRedaction {
  statusCode: number;
  message: string | string[];
  causes?: string[];
  revisionCourante?: number;
  auteur?: string;
  citants?: string[];
}

/** Rédaction des articles du blog depuis l'administration (chantier `articles-en-base`). */
@Injectable({ providedIn: 'root' })
export class AdminArticlesService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);
  private get base() {
    return `${this.config.apiUrl}/admin/articles`;
  }

  lister$(): Observable<ArticleRedaction[]> {
    return this.http.get<ArticleRedaction[]>(this.base);
  }

  lire$(id: number): Observable<ArticleRedaction> {
    return this.http.get<ArticleRedaction>(`${this.base}/${id}`);
  }

  verifier$(source: string, id?: number): Observable<VerificationArticle> {
    return this.http.post<VerificationArticle>(`${this.base}/verifier`, { source, ...(id ? { id } : {}) });
  }

  enregistrer$(source: string, id?: number, revisionAttendue?: number): Observable<ArticleRedaction> {
    return this.http.put<ArticleRedaction>(this.base, { source, ...(id ? { id, revisionAttendue } : {}) });
  }

  publier$(path: string): Observable<ArticleRedaction[]> {
    return this.http.post<ArticleRedaction[]>(`${this.base}/publier`, { paths: [path] });
  }

  depublier$(path: string): Observable<ArticleRedaction> {
    return this.http.post<ArticleRedaction>(`${this.base}/depublier`, { path });
  }

  revisions$(id: number): Observable<RevisionArticle[]> {
    return this.http.get<RevisionArticle[]>(`${this.base}/${id}/revisions`);
  }

  revision$(id: number, numero: number): Observable<{ numero: number; source: string }> {
    return this.http.get<{ numero: number; source: string }>(`${this.base}/${id}/revisions/${numero}`);
  }

  restaurer$(id: number, numero: number): Observable<ArticleRedaction> {
    return this.http.post<ArticleRedaction>(`${this.base}/${id}/restaurer/${numero}`, {});
  }

  supprimer$(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  jetons$(): Observable<JetonRedaction[]> {
    return this.http.get<JetonRedaction[]>(`${this.config.apiUrl}/admin/jetons`);
  }

  creerJeton$(nom: string): Observable<JetonRedaction & { valeur: string }> {
    return this.http.post<JetonRedaction & { valeur: string }>(`${this.config.apiUrl}/admin/jetons`, { nom });
  }

  revoquerJeton$(id: number): Observable<JetonRedaction> {
    return this.http.delete<JetonRedaction>(`${this.config.apiUrl}/admin/jetons/${id}`);
  }
}

/** Les causes lisibles d'une erreur HTTP de l'API de rédaction. */
export function lireErreur(e: unknown): ErreurRedaction {
  const corps = (e as { error?: ErreurRedaction; status?: number })?.error;
  if (corps && typeof corps === 'object') return corps;
  return { statusCode: (e as { status?: number })?.status ?? 0, message: 'Le serveur ne répond pas. Réessayez.' };
}

/** Gabarit d'un nouvel article : un brouillon à compléter, valide une fois rempli. */
export function gabaritDArticle(aujourdhui: string): string {
  return [
    '---',
    'path: /blog/nouvel-article',
    'title: Titre de la page (onglet et partage)',
    'description: Une ou deux phrases pour les moteurs de recherche.',
    "titre: Titre de la carte dans l'index",
    'extrait: Une phrase pour la carte de l’index.',
    'categorie: Méthode',
    `publie: ${aujourdhui}`,
    `misAJour: ${aujourdhui}`,
    '---',
    '# Titre de l’article',
    '',
    'Premier paragraphe. {.lead}',
    '',
    '## Première section',
    '',
    'Texte.',
    '',
  ].join('\n');
}
