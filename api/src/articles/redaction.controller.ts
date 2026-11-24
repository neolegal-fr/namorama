import {
  BadRequestException,
  Body,
  Controller,
  createParamDecorator,
  Delete,
  ExecutionContext,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthenticatedUser, Public, Roles } from 'nest-keycloak-connect';
import { ArticlesService } from './articles.service';
import type { Auteur } from './articles.service';
import { CheminDto, CheminsDto, EnregistrerDto, LotDto, NomDeJetonDto, VerifierDto } from './dto';
import { JetonDeRedactionGuard } from './jeton-de-redaction.guard';
import { JetonsService } from './jetons.service';

/** L'auteur posé par `JetonDeRedactionGuard` : le jeton, désigné par son nom. */
const AuteurDuJeton = createParamDecorator((_: unknown, ctx: ExecutionContext): Auteur => ctx.switchToHttp().getRequest().auteurRedaction);

/**
 * Rédaction par jeton (`/redaction/articles`) : ce qu'emploient Claude et les recettes
 * `just article-*`. Mêmes règles que l'écran, sauf la suppression, qui reste un geste de
 * l'administration.
 */
@Controller('redaction/articles')
@Public()
@UseGuards(JetonDeRedactionGuard)
export class RedactionController {
  constructor(private readonly articles: ArticlesService) {}

  /** Tous les articles, brouillons compris, sans leur texte. */
  @Get()
  async lister() {
    const tous = await this.articles.lister();
    return tous.map(({ path, titre, categorie, etat, publie, misAJour, revision, majPar, majLe }) => ({
      path,
      titre,
      categorie,
      etat,
      publie,
      misAJour,
      revision,
      majPar,
      majLe,
    }));
  }

  /** La source au format Markdown, avec la ligne `# revision: N` à renvoyer. */
  @Get('source')
  source(@Query('path') path: string) {
    if (typeof path !== 'string' || !path.startsWith('/')) throw new BadRequestException('Paramètre path attendu');
    return this.articles.exporter(path);
  }

  @Post('verifier')
  @HttpCode(200)
  verifier(@Body() body: VerifierDto) {
    return this.articles.verifier(body.source, { publier: body.publier });
  }

  @Put()
  async enregistrer(@Body() body: EnregistrerDto, @AuteurDuJeton() auteur: Auteur) {
    if (body.id !== undefined) throw new BadRequestException('Par jeton, un article se désigne par son path, pas par son id');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { source, ...vue } = await this.articles.enregistrer(body, auteur);
    return vue;
  }

  @Put('lot')
  enregistrerLot(@Body() body: LotDto, @AuteurDuJeton() auteur: Auteur) {
    return this.articles.enregistrerLot(body.sources, auteur, { publier: body.publier });
  }

  @Post('publier')
  @HttpCode(200)
  async publier(@Body() body: CheminsDto, @AuteurDuJeton() auteur: Auteur) {
    const vues = await this.articles.publier(body.paths, auteur);
    return vues.map(({ path, etat, publie, revision }) => ({ path, etat, publie, revision }));
  }

  @Post('depublier')
  @HttpCode(200)
  async depublier(@Body() body: CheminDto, @AuteurDuJeton() auteur: Auteur) {
    const { path, etat, publie, revision } = await this.articles.depublier(body.path, auteur);
    return { path, etat, publie, revision };
  }
}

/** Jetons de rédaction, gérés depuis l'administration. */
@Controller('admin/jetons')
@Roles({ roles: ['realm:admin'] })
export class AdminJetonsController {
  constructor(private readonly jetons: JetonsService) {}

  @Get()
  lister() {
    return this.jetons.lister();
  }

  /** La valeur n'est rendue qu'ici, une seule fois. */
  @Post()
  creer(@Body() body: NomDeJetonDto, @AuthenticatedUser() user: any) {
    return this.jetons.creer(body.nom, String(user?.sub ?? ''));
  }

  @Delete(':id')
  revoquer(@Param('id', ParseIntPipe) id: number, @AuthenticatedUser() user: any) {
    return this.jetons.revoquer(id, String(user?.sub ?? ''));
  }
}
