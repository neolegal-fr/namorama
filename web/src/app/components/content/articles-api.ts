import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, InjectionToken, PLATFORM_ID, RESPONSE_INIT, TransferState, inject, makeStateKey } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import type { ActivatedRouteSnapshot, ResolveFn, RouterStateSnapshot } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '../../services/config';
import type { Article, ArticleMarkdown } from './articles';

/**
 * Adresse de l'API vue du service de rendu (`API_INTERNE_URL`, `http://api:3000` en
 * production). Fournie par `app.config.server.ts` seulement : le navigateur emploie
 * `config.json`, que le serveur ne charge pas.
 */
export const URL_API_SERVEUR = new InjectionToken<string>('URL_API_SERVEUR');

/** Ce qu'une page du blog sait de sa source : servie, absente, ou source en panne. */
export type Lecture<T> = { etat: 'ok'; valeur: T } | { etat: 'absent' } | { etat: 'indisponible' };

/** Délai suggéré aux robots quand la source est en panne (503). */
export const RETRY_AFTER_S = 120;

/**
 * Lecture des articles parus, depuis l'API (chantier `articles-en-base`).
 *
 * Côté serveur, le résultat est déposé dans `TransferState` : le navigateur reprend la
 * page sans rappeler l'API. Une panne de l'API n'est **jamais** une absence : elle
 * donne `indisponible`, que la page traduit en 503 — un 404 ferait désindexer un
 * article qui existe.
 */
@Injectable({ providedIn: 'root' })
export class ArticlesApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);
  private readonly transfert = inject(TransferState);
  private readonly serveur = isPlatformServer(inject(PLATFORM_ID));
  private readonly urlServeur = inject(URL_API_SERVEUR, { optional: true });

  private base(): string {
    return (this.serveur ? (this.urlServeur ?? '') : this.config.apiUrl).replace(/\/$/, '');
  }

  parus(): Promise<Lecture<Article[]>> {
    return this.lire(makeStateKey<Lecture<Article[]>>('blog:parus'), `${this.base()}/articles`);
  }

  article(path: string): Promise<Lecture<ArticleMarkdown>> {
    return this.lire(
      makeStateKey<Lecture<ArticleMarkdown>>(`blog:article:${path}`),
      `${this.base()}/articles/contenu?path=${encodeURIComponent(path)}`,
    );
  }

  private async lire<T>(cle: ReturnType<typeof makeStateKey<Lecture<T>>>, url: string): Promise<Lecture<T>> {
    if (!this.serveur && this.transfert.hasKey(cle)) {
      const deja = this.transfert.get(cle, null)!;
      this.transfert.remove(cle);
      if (deja.etat !== 'indisponible') return deja;
    }
    let lu: Lecture<T>;
    try {
      lu = { etat: 'ok', valeur: await firstValueFrom(this.http.get<T>(url)) };
    } catch (e) {
      lu = e instanceof HttpErrorResponse && e.status === 404 ? { etat: 'absent' } : { etat: 'indisponible' };
      if (lu.etat === 'indisponible' && this.serveur) {
        // Le service du blog n'a pas d'autre journal que sa sortie : une ligne NDJSON,
        // au format des journaux de l'API, lisible par `docker logs`.
        console.error(
          JSON.stringify({
            ts: new Date().toISOString(),
            kind: 'event',
            level: 'error',
            context: 'blog_source_unavailable',
            url: url.replace(/^https?:\/\/[^/]+/, ''),
            status: e instanceof HttpErrorResponse ? e.status : null,
          }),
        );
      }
    }
    if (this.serveur) this.transfert.set(cle, lu);
    return lu;
  }
}

/**
 * Statut HTTP de la page rendue par le serveur (`reponse` est nul dans le navigateur).
 * `RESPONSE_INIT` s'obtient AVANT tout `await` : passé le premier, un résolveur n'est
 * plus dans un contexte d'injection.
 */
export function poserStatut(reponse: ResponseInit | null, lecture: Lecture<unknown>): void {
  if (!reponse || lecture.etat === 'ok') return;
  if (lecture.etat === 'absent') {
    reponse.status = 404;
    return;
  }
  reponse.status = 503;
  if (reponse.headers instanceof Headers) reponse.headers.set('Retry-After', String(RETRY_AFTER_S));
  else reponse.headers = { ...((reponse.headers as Record<string, string>) ?? {}), 'Retry-After': String(RETRY_AFTER_S) };
}

/** Chemin d'article d'une adresse : sans paramètres, ancre ni slash final. */
export function cheminDe(url: string): string {
  return url.split(/[?#]/)[0].replace(/(.)\/$/, '$1');
}

export const resoudreParus: ResolveFn<Lecture<Article[]>> = async () => {
  const reponse = inject(RESPONSE_INIT, { optional: true });
  const lu = await inject(ArticlesApi).parus();
  poserStatut(reponse, lu);
  return lu;
};

export const resoudreArticle: ResolveFn<Lecture<ArticleMarkdown>> = async (
  _route: ActivatedRouteSnapshot,
  etat: RouterStateSnapshot,
) => {
  const reponse = inject(RESPONSE_INIT, { optional: true });
  const lu = await inject(ArticlesApi).article(cheminDe(etat.url));
  poserStatut(reponse, lu);
  return lu;
};
