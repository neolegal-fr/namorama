import { BadRequestException, Body, Controller, DefaultValuePipe, Get, HttpCode, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
// Le `Public` de nest-keycloak-connect, comme `POST /events` : celui de
// `common/decorators` n'est pas lu par la garde, et la route répondait 401.
import { Public, Roles } from 'nest-keycloak-connect';
import { ReplayChunkDto } from './dto/replay-chunk.dto';
import { FILTRES, FiltreRejeu, ReplayService } from './replay.service';

/**
 * Réception des lots du navigateur. Publique comme `POST /events` : la plupart
 * des visiteurs n'ont pas de compte. Le corps est limité à part (`main.ts`),
 * et le service applique les plafonds par visite et par jour.
 */
@Controller('replay')
export class ReplayController {
  constructor(private readonly replay: ReplayService) {}

  @Public()
  @Post()
  @HttpCode(204)
  async recevoir(@Body() dto: ReplayChunkDto): Promise<void> {
    await this.replay.recevoir(dto);
  }
}

/** Liste et relecture, pour l'administration seulement. */
@Controller('admin/replays')
@Roles({ roles: ['realm:admin'] })
export class AdminReplayController {
  constructor(private readonly replay: ReplayService) {}

  @Get()
  lister(
    @Query('filtre') filtre?: string,
    @Query('compte') compte?: string,
    @Query('page', new DefaultValuePipe(0), ParseIntPipe) page = 0,
  ) {
    if (filtre && !FILTRES.includes(filtre as FiltreRejeu)) {
      throw new BadRequestException(`Filtre inconnu : ${filtre}`);
    }
    return this.replay.lister({
      filtre: (filtre as FiltreRejeu) || undefined,
      compte: compte || undefined,
      page,
    });
  }

  /** Comptes ayant au moins une visite enregistrée — pour le raccourci du tableau des utilisateurs. */
  @Get('comptes')
  comptes() {
    return this.replay.comptesEnregistres();
  }

  // Après `comptes` : déclarée avant, `:sessionId` capturerait ce chemin.
  @Get(':sessionId')
  lire(@Param('sessionId') sessionId: string) {
    return this.replay.lire(sessionId);
  }
}
