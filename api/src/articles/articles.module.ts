import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminArticlesController } from './admin-articles.controller';
import { ArticlesController } from './articles.controller';
import { ArticlesService } from './articles.service';
import { JetonDeRedactionGuard } from './jeton-de-redaction.guard';
import { JetonsService } from './jetons.service';
import { AdminJetonsController, RedactionController } from './redaction.controller';
import { Article } from './entities/article.entity';
import { ArticleRevision } from './entities/article-revision.entity';
import { JetonApi } from './entities/jeton-api.entity';

/**
 * Articles du blog en base (chantier `articles-en-base`) : lecture publique, rédaction
 * depuis l'administration et par jeton (Claude).
 */
@Module({
  imports: [TypeOrmModule.forFeature([Article, ArticleRevision, JetonApi])],
  controllers: [ArticlesController, AdminArticlesController, RedactionController, AdminJetonsController],
  providers: [ArticlesService, JetonsService, JetonDeRedactionGuard],
  exports: [ArticlesService],
})
export class ArticlesModule {}
