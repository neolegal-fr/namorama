import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import { Public } from 'nest-keycloak-connect';
import type { Request } from 'express';
import { TrackEventDto } from './dto/track-event.dto';
import { AppLoggerService } from '../common/logging/app-logger.service';
import { FunnelService } from '../common/funnel/funnel.service';

/**
 * Collecte des étapes de parcours envoyées par le front.
 *
 * Pourquoi ne pas se reposer sur Google Analytics seul : la mesure y est
 * conditionnée au consentement cookies, donc aveugle sur une partie du trafic —
 * précisément celle qui abandonne le plus tôt. Ces événements-ci sont
 * anonymes (aucun cookie, identifiant de session éphémère côté navigateur) et
 * servent au diagnostic produit : où s'arrête un utilisateur, et pourquoi.
 */
@Controller('events')
export class EventsController {
  /** Garde-fou : au-delà, on tronque plutôt que de polluer les logs. */
  private readonly MAX_META_KEYS = 20;
  private readonly MAX_VALUE_LENGTH = 300;

  /**
   * Le seul événement qui compte une VISITE, et donc le dénominateur de tout
   * l'entonnoir. Émis au premier affichage d'une page — c'est là, et nulle part
   * ailleurs, qu'on voit quelqu'un qui repart sans rien faire.
   */
  private static readonly VISITE = 'page_viewed';

  /**
   * L'ouverture du dialogue des packs, seule « page tarifs » du produit.
   * Marquée sur la visite plutôt que laissée aux seuls logs : ceux-ci tournent
   * sur 30 jours, et la question « l'offre est-elle vue ? » se pose sur des
   * mois — personne n'a encore rien acheté.
   */
  private static readonly TARIFS = 'credits_dialog_opened';

  constructor(
    private readonly logger: AppLoggerService,
    private readonly funnel: FunnelService,
  ) {}

  @Public()
  @Post()
  @HttpCode(204)
  async track(@Body() dto: TrackEventDto, @Req() req: Request & { user?: { sub?: string } }) {
    if (dto.name === EventsController.VISITE) {
      // `await` bien que la balise `sendBeacon` n'attende pas la réponse :
      // sans lui, Nest clôt la requête pendant l'écriture, et une erreur de
      // base partirait dans le vide au lieu d'être journalisée.
      await this.funnel.visite(dto.sessionId, dto.meta?.['connecte'] === true);
    } else if (dto.name === EventsController.TARIFS) {
      // Sans `sub` : la balise part sans jeton, et le navigateur ne doit pas
      // pouvoir s'attribuer un compte. Le rattachement viendra des appels
      // authentifiés de la même session.
      await this.funnel.marquer(dto.sessionId, 'tarifs');
    }

    this.logger.event(dto.name, {
      sessionId: dto.sessionId,
      userId: req.user?.sub,
      path: (req.headers['referer'] as string) ?? undefined,
      ...this.sanitize(dto.meta),
    });
  }

  /**
   * Le corps vient du navigateur : on borne la taille et on aplatit les valeurs
   * pour qu'une ligne de log reste lisible et qu'on ne stocke rien d'imprévu.
   */
  private sanitize(meta?: Record<string, unknown>): Record<string, unknown> {
    if (!meta) return {};
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(meta).slice(0, this.MAX_META_KEYS)) {
      if (value === null || value === undefined) continue;
      if (typeof value === 'number' || typeof value === 'boolean') {
        out[key] = value;
      } else {
        out[key] = String(value).slice(0, this.MAX_VALUE_LENGTH);
      }
    }
    return out;
  }
}
