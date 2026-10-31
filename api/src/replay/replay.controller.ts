import { BadRequestException, Body, Controller, DefaultValuePipe, Get, HttpCode, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { Roles } from 'nest-keycloak-connect';
import { Public } from '../common/decorators/public.decorator';
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

  @Get(':sessionId')
  lire(@Param('sessionId') sessionId: string) {
    return this.replay.lire(sessionId);
  }
}
