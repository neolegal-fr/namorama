import { AsyncLocalStorage } from 'node:async_hooks';
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import type { Request } from 'express';

/**
 * À qui imputer un appel au modèle, sans le demander à chaque signature.
 *
 * Les appels OpenAI vivent au fond de `DomainService` et de
 * `NameVariantsService`, qui ne savent pas pour quel compte ils travaillent.
 * Passer un `sub` à travers dix méthodes, et aux méthodes qui les appellent,
 * aurait tordu toute la chaîne pour une statistique. Le contexte suit donc la
 * requête, et ne se lit qu'au moment de noter.
 */
export interface ContexteAppel {
  req: Request & { user?: { sub?: string } };
  /**
   * Compte à débiter, quand ce n'est pas celui du jeton. Sur un projet partagé
   * en écriture, c'est le propriétaire qui paie les crédits — il paie donc
   * aussi, dans ces chiffres, ce que ses crédits ont déclenché.
   */
  imputeA?: string;
  projectId?: string;
}

const stockage = new AsyncLocalStorage<ContexteAppel>();

export function contexteCourant(): ContexteAppel | undefined {
  return stockage.getStore();
}

/**
 * Désigne le compte débité pour le reste de la requête.
 *
 * Sans contexte (tâche de fond, test), l'appel est sans effet : l'imputation
 * est une information, jamais une condition.
 */
export function imputer(keycloakId: string | undefined, projectId?: string): void {
  const ctx = stockage.getStore();
  if (!ctx) return;
  if (keycloakId) ctx.imputeA = keycloakId;
  if (projectId) ctx.projectId = projectId;
}

/**
 * Ouvre le contexte autour du gestionnaire de route.
 *
 * Un INTERCEPTEUR, et non un middleware Express : un middleware posé avant le
 * `body-parser` perd le contexte dès que le corps est lu — les événements du
 * flux de la requête sont émis depuis la socket, hors de `run()`. L'intercepteur
 * s'exécute après les gardes et l'analyse du corps, et le gestionnaire est
 * invoqué à la souscription, donc DANS `run()`.
 *
 * Le contexte garde la requête elle-même plutôt qu'une copie du `sub` : sur une
 * route `@Public()`, il n'y en a pas, et c'est la session qui fera le lien.
 */
@Injectable()
export class ContexteAppelInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();
    const req = context.switchToHttp().getRequest();
    return new Observable((abonne) => {
      const abonnement = stockage.run({ req }, () => next.handle().subscribe(abonne));
      return () => abonnement.unsubscribe();
    });
  }
}
