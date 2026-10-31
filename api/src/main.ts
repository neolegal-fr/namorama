import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { AppLoggerService } from './common/logging/app-logger.service';
import { RequestLoggingInterceptor } from './common/logging/request-logging.interceptor';
import { json } from 'express';

/** Taille maximale d'un lot du rejeu, JSON non compressé. */
const LIMITE_CORPS_REJEU = '1mb';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true, bufferLogs: true });

  // Journalisation structurée, persistée hors du conteneur (cf. LOG_DIR).
  // Remplace le logger par défaut de Nest : les traces des dépendances passent
  // donc aussi par lui — notamment nest-keycloak-connect, dont le niveau
  // `verbose` recrache le JWT complet à chaque requête et n'est jamais relayé.
  const logger = app.get(AppLoggerService);
  app.useLogger(logger);

  // Lots du rejeu (`POST /replay`) : le premier porte l'instantané complet de la
  // page, feuilles de style comprises, bien au-delà des 100 ko par défaut.
  // Monté sur CE SEUL chemin, avant les parseurs de Nest (posés à `listen`) :
  // partout ailleurs, la limite par défaut reste en vigueur.
  app.use('/replay', json({ limit: LIMITE_CORPS_REJEU }));
  app.useGlobalInterceptors(new RequestLoggingInterceptor(logger));

  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:4200',
    credentials: true,
    // `X-Session-Id` porte l'identifiant de visite anonyme (cf. FunnelService) :
    // sans lui dans cette liste, le navigateur bloque la requête au préalable.
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Id'],
  });

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  app.useGlobalFilters(new AllExceptionsFilter(logger));

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
