import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Article } from './entities/article.entity';
import { ArticleRevision } from './entities/article-revision.entity';
import { JetonApi } from './entities/jeton-api.entity';

/**
 * Articles du blog en base (chantier `articles-en-base`) : lecture publique, rédaction
 * depuis l'administration et par jeton (Claude).
 */
@Module({
  imports: [TypeOrmModule.forFeature([Article, ArticleRevision, JetonApi])],
})
export class ArticlesModule {}
