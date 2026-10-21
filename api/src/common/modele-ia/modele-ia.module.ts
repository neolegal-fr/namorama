import { Global, Module } from '@nestjs/common';
import { ModeleIA } from './modele-ia.service';

/**
 * Global, comme le relevé de consommation : les appels au modèle partent de
 * trois modules (domain, brand-report, admin), et tous doivent passer par le
 * même choix de fournisseur.
 */
@Global()
@Module({
  providers: [ModeleIA],
  exports: [ModeleIA],
})
export class ModeleIAModule {}
