import { BadRequestException, Controller, Get, Header, Query } from '@nestjs/common';
// Le `Public` de nest-keycloak-connect, celui que lit le garde global — pas celui de
// `common/decorators`, sans effet sur lui.
import { Public } from 'nest-keycloak-connect';
import { ArticlesService } from './articles.service';

/**
 * Lecture publique des articles parus : ce que rend le service du blog (index, pages,
 * plan du site) et ce que relit le navigateur.
 *
 * `no-cache` : une correction enregistrée doit être servie à la visite suivante. Le
 * coût est une lecture indexée ; le blog n'a pas le trafic qui justifierait un cache.
 */
@Controller('articles')
@Public()
export class ArticlesController {
  constructor(private readonly articles: ArticlesService) {}

  @Get()
  @Header('Cache-Control', 'no-cache')
  parus() {
    return this.articles.parus();
  }

  @Get('contenu')
  @Header('Cache-Control', 'no-cache')
  contenu(@Query('path') path: string) {
    if (typeof path !== 'string' || !path.startsWith('/') || path.length > 200) {
      throw new BadRequestException('Paramètre path attendu (ex. /blog/mon-article)');
    }
    return this.articles.paru(path);
  }
}
