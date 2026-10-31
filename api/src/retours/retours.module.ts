import { Module } from '@nestjs/common';
import { RetoursController } from './retours.controller';
import { RetoursService } from './retours.service';

/** Réponses publiques aux demandes de retour (chantier `demande-de-retour-automatique`). */
@Module({
  controllers: [RetoursController],
  providers: [RetoursService],
})
export class RetoursModule {}
