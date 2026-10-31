/**
 * Rattrapage du registre des paiements, à lancer une fois après la migration
 * `2026-10-31-registre-des-paiements.sql` et le déploiement de l'image :
 *
 *   docker compose exec api node dist/scripts/rattraper-paiements.js
 *
 * Relit chez Stripe chaque session déjà traitée (`stripe_event`) et l'inscrit
 * au registre si elle est payée. N'ajoute aucun crédit, et se rejoue sans
 * effet : une session déjà inscrite est ignorée.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PaymentsService } from '../payments/payments.service';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const bilan = await app.get(PaymentsService).rattraperPaiements();
    for (const l of bilan) {
      console.log(JSON.stringify(l));
    }
    const inscrites = bilan.filter((l) => l.inscrite).length;
    const erreurs = bilan.filter((l) => l.erreur).length;
    console.log(`${bilan.length} session(s) lue(s), ${inscrites} inscrite(s), ${erreurs} erreur(s).`);
    process.exitCode = erreurs > 0 ? 1 : 0;
  } finally {
    await app.close();
  }
}

void main();
