import { Body, Controller, HttpCode, Post, Query } from '@nestjs/common';
// Le `Public` de nest-keycloak-connect, celui que lit le garde global — pas
// celui de `common/decorators`, qui n'a aucun effet sur l'authentification.
import { Public } from 'nest-keycloak-connect';
import { RetoursService } from './retours.service';

/**
 * Routes publiques des liens de demande de retour. Le jeton signé tient lieu
 * de connexion. Des POST, jamais des GET : un antivirus qui suit le lien du
 * courriel ne doit rien enregistrer.
 */
@Controller('retours')
export class RetoursController {
  constructor(private readonly retours: RetoursService) {}

  /** « Namorama vous a-t-il été utile ? » — appelée par la page `/retour`. */
  @Public()
  @Post('utilite')
  @HttpCode(200)
  repondre(@Body() body: { j?: unknown }) {
    return this.retours.repondre(body?.j);
  }

  /**
   * Désinscription : depuis la page `/desinscription` (`{ j }` dans le corps),
   * ou en un clic par la messagerie (RFC 8058 : POST `List-Unsubscribe=One-Click`,
   * le jeton dans l'adresse).
   */
  @Public()
  @Post('desinscription')
  @HttpCode(200)
  desinscrire(@Body() body: { j?: unknown }, @Query('j') j?: string) {
    return this.retours.desinscrire(body?.j ?? j);
  }
}
