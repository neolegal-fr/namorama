import {
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { AllExceptionsFilter } from './http-exception.filter';

/**
 * Le niveau de log décide de ce qu'on voit : 98 % des err/warn de production
 * venaient de scanners frappant des routes inexistantes, ce qui noyait les
 * vrais blocages. Ces tests fixent la frontière.
 */
describe('AllExceptionsFilter — niveaux de journalisation', () => {
  function run(exception: unknown, url = '/whatever') {
    const write = jest.fn();
    const event = jest.fn();
    const response = { getHeader: () => 'req-1', status: () => ({ json: () => undefined }) };
    const request = { method: 'GET', url, path: url, user: { sub: 'kc-1' } };
    const host = { switchToHttp: () => ({ getResponse: () => response, getRequest: () => request }) };
    new AllExceptionsFilter({ write, event } as any).catch(exception, host as any);
    return { entry: write.mock.calls[0][0], event };
  }

  /** « Cannot GET /1.php » = message générique du routeur, donc balayage. */
  it('journalise en info un 404 de route inexistante', () => {
    const { entry } = run(new NotFoundException('Cannot GET /1.php'), '/1.php');
    expect(entry.level).toBe('info');
    expect(entry.unmatchedRoute).toBe(true);
  });

  /** Un 404 métier porte un message propre : c'est un blocage vécu. */
  it('journalise en warn un 404 métier', () => {
    const { entry } = run(new NotFoundException('Rapport introuvable'), '/brand-report/shared/abc');
    expect(entry.level).toBe('warn');
    expect(entry.unmatchedRoute).toBeUndefined();
  });

  it('journalise en warn les autres 4xx', () => {
    const { entry } = run(new ForbiddenException('Crédits insuffisants'), '/brand-report');
    expect(entry.level).toBe('warn');
  });

  it('journalise en error les 5xx', () => {
    const { entry } = run(new InternalServerErrorException('boom'), '/domain/search');
    expect(entry.level).toBe('error');
  });

  /** Le tunnel doit continuer de voir les refus de validation (cf. 2 août). */
  it('émet toujours search_blocked_validation sur un 400 de recherche', () => {
    const { event, entry } = run(
      new BadRequestException('Maximum 50 mots-clés autorisés'),
      '/domain/search/stream',
    );
    expect(entry.level).toBe('warn');
    expect(event).toHaveBeenCalledWith(
      'search_blocked_validation',
      expect.objectContaining({ reason: 'Maximum 50 mots-clés autorisés' }),
    );
  });

  /**
   * Le parseur de corps lève ses erreurs avant Nest, au format http-errors.
   * Un corps trop gros n'est pas une panne : 413 en warn, sans pile — et le
   * navigateur du rejeu, qui s'arrête sur un 4xx, cesse d'envoyer.
   */
  it('rend 413, en warn, un corps trop gros refusé par le parseur', () => {
    const trop = Object.assign(new Error('request entity too large'), {
      status: 413, statusCode: 413, expose: true, type: 'entity.too.large',
    });
    const { entry } = run(trop, '/replay');
    expect(entry.status).toBe(413);
    expect(entry.level).toBe('warn');
    expect(entry.stack).toBeUndefined();
  });

  it('laisse en 500 une erreur interne qui porterait un statut sans expose', () => {
    const interne = Object.assign(new Error('pool épuisé'), { status: 400 });
    const { entry } = run(interne, '/replay');
    expect(entry.status).toBe(500);
  });
});
