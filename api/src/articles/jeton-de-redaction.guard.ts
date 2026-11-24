import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Auteur } from './articles.service';
import { JetonsService } from './jetons.service';

/**
 * En-tête du jeton de rédaction.
 *
 * Pas `Authorization: Bearer` : le garde global de `nest-keycloak-connect` tente de
 * valider tout porteur, même sur une route publique, et rejetterait un jeton qui n'est
 * pas un JWT. Réciproquement, cet en-tête n'ouvre aucune route d'administration : le
 * garde Keycloak ne le lit pas.
 */
export const EN_TETE_JETON = 'x-namorama-jeton';

/** Garde des routes `/redaction/…` : un jeton actif de portée `articles`, sinon 401. */
@Injectable()
export class JetonDeRedactionGuard implements CanActivate {
  constructor(private readonly jetons: JetonsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const jeton = await this.jetons.authentifier(req.headers?.[EN_TETE_JETON], 'articles');
    if (!jeton) throw new UnauthorizedException(`Jeton de rédaction absent, inconnu ou révoqué (en-tête ${EN_TETE_JETON})`);
    const auteur: Auteur = { type: 'jeton', id: String(jeton.id), nom: jeton.nom };
    req.auteurRedaction = auteur;
    return true;
  }
}
