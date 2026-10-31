import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { AppLoggerService } from '../logging/app-logger.service';

/**
 * Routes dont un refus de validation est une étape de parcours perdue.
 *
 * La requête est rejetée par le ValidationPipe **avant** d'atteindre le
 * contrôleur : aucun `search_started` n'est émis, et le tunnel affiche alors
 * 100 % de réussite alors que l'utilisateur n'a jamais pu lancer sa recherche.
 * Ces événements comblent l'angle mort.
 */
const BLOCKED_FUNNEL_ROUTES: ReadonlyArray<readonly [RegExp, string]> = [
  [/^\/domain\/search/, 'search_blocked_validation'],
];

/**
 * Erreur client au format `http-errors` (celui de body-parser) : un statut 4xx
 * et `expose: true`, qui signifie que le message peut être montré au client.
 */
function erreurClientExpress(e: unknown): e is { status: number; message: string } {
  const x = e as { status?: unknown; expose?: unknown } | null;
  return !!x && typeof x.status === 'number' && x.status >= 400 && x.status < 500 && x.expose === true;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLoggerService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { user?: { sub?: string } }>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Erreur interne du serveur';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      message = typeof res === 'string' ? res : (res as any).message || message;
    } else if (erreurClientExpress(exception)) {
      // Erreur levée AVANT Nest, par le parseur de corps : corps trop gros
      // (413), JSON illisible (400). Ce n'est pas une panne du serveur. En 500,
      // elle se journalisait en erreur avec sa pile, et le navigateur du rejeu,
      // qui ne s'arrête que sur un 4xx, aurait renvoyé ses lots en boucle.
      status = exception.status;
      message = exception.message;
    }

    const detail = Array.isArray(message) ? message.join(' | ') : String(message);
    const requestId = response.getHeader('X-Request-Id') as string | undefined;

    // Route inexistante : le message est celui, générique, du routeur
    // (« Cannot GET /1.php »). C'est du balayage automatisé, pas un blocage
    // vécu — 98 % des err/warn de production en venaient, rendant le mode
    // `errors` inutilisable. On garde la ligne (volumétrie, détection d'abus)
    // mais en `info`. Un 404 métier — NotFoundException('Rapport introuvable')
    // — porte un message propre et reste donc en `warn`.
    const unmatchedRoute = status === HttpStatus.NOT_FOUND && /^Cannot [A-Z]+ /.test(detail);

    // Toutes les erreurs sont journalisées, y compris les 4xx : ce sont elles
    // qui révèlent les blocages vécus par les utilisateurs (crédits épuisés,
    // validation refusée, session expirée). La pile n'est utile que sur les 5xx.
    this.logger.write({
      kind: 'log',
      level: status >= 500 ? 'error' : unmatchedRoute ? 'info' : 'warn',
      context: 'HttpException',
      message: detail,
      status,
      unmatchedRoute: unmatchedRoute || undefined,
      method: request.method,
      path: request.url,
      userId: request.user?.sub,
      requestId,
      stack: status >= 500 && exception instanceof Error ? exception.stack : undefined,
    });

    if (status === HttpStatus.BAD_REQUEST) {
      const blocked = BLOCKED_FUNNEL_ROUTES.find(([pattern]) => pattern.test(request.path));
      if (blocked) {
        this.logger.event(blocked[1], {
          userId: request.user?.sub,
          requestId,
          path: request.path,
          reason: detail.slice(0, 200),
        });
      }
    }

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
