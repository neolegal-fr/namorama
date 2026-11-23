import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { AuthenticatedUser, Roles } from 'nest-keycloak-connect';
import { ArticlesService, Auteur } from './articles.service';
import { CheminDto, CheminsDto, EnregistrerDto, VerifierDto } from './dto';

/** L'auteur d'une modification faite depuis l'écran : le compte, désigné par son adresse. */
export function auteurDuCompte(user: { sub?: string; email?: string; preferred_username?: string }): Auteur {
  return { type: 'compte', id: String(user?.sub ?? ''), nom: String(user?.email ?? user?.preferred_username ?? user?.sub ?? 'administrateur').slice(0, 120) };
}

/**
 * Rédaction des articles depuis l'administration (`/admin/articles`).
 * Réservé au rôle realm `admin`, comme le reste de `/admin`.
 */
@Controller('admin/articles')
@Roles({ roles: ['realm:admin'] })
export class AdminArticlesController {
  constructor(private readonly articles: ArticlesService) {}

  @Get()
  lister() {
    return this.articles.lister();
  }

  @Post('verifier')
  @HttpCode(200)
  verifier(@Body() body: VerifierDto) {
    return this.articles.verifier(body.source, { id: body.id, publier: body.publier });
  }

  @Put()
  enregistrer(@Body() body: EnregistrerDto, @AuthenticatedUser() user: any) {
    return this.articles.enregistrer(body, auteurDuCompte(user));
  }

  @Post('publier')
  @HttpCode(200)
  publier(@Body() body: CheminsDto, @AuthenticatedUser() user: any) {
    return this.articles.publier(body.paths, auteurDuCompte(user));
  }

  @Post('depublier')
  @HttpCode(200)
  depublier(@Body() body: CheminDto, @AuthenticatedUser() user: any) {
    return this.articles.depublier(body.path, auteurDuCompte(user));
  }

  @Get(':id')
  lire(@Param('id', ParseIntPipe) id: number) {
    return this.articles.lire(id);
  }

  @Get(':id/revisions')
  revisions(@Param('id', ParseIntPipe) id: number) {
    return this.articles.revisions(id);
  }

  @Get(':id/revisions/:numero')
  revision(@Param('id', ParseIntPipe) id: number, @Param('numero', ParseIntPipe) numero: number) {
    return this.articles.revision(id, numero);
  }

  @Post(':id/restaurer/:numero')
  @HttpCode(200)
  restaurer(
    @Param('id', ParseIntPipe) id: number,
    @Param('numero', ParseIntPipe) numero: number,
    @AuthenticatedUser() user: any,
  ) {
    return this.articles.restaurer(id, numero, auteurDuCompte(user));
  }

  @Delete(':id')
  @HttpCode(204)
  async supprimer(@Param('id', ParseIntPipe) id: number, @AuthenticatedUser() user: any) {
    await this.articles.supprimer(id, auteurDuCompte(user));
  }
}
