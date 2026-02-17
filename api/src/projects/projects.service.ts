import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from './entities/project.entity';
import { DomainSuggestion } from './entities/domain-suggestion.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private projectsRepository: Repository<Project>,
    @InjectRepository(DomainSuggestion)
    private suggestionsRepository: Repository<DomainSuggestion>,
  ) {}

  async findAllByUser(user: User): Promise<Project[]> {
    return this.projectsRepository.find({
      where: { user: { id: user.id } },
      order: { updatedAt: 'DESC' },
    });
  }

  async findOne(id: string, user: User): Promise<Project> {
    const project = await this.projectsRepository.findOne({
      where: { id, user: { id: user.id } },
      relations: ['suggestions'],
    });

    if (!project) {
      throw new NotFoundException('Projet non trouvé');
    }

    // Trier les suggestions pour mettre les favoris en premier
    project.suggestions.sort((a, b) => {
      if (a.isFavorite === b.isFavorite) return 0;
      return a.isFavorite ? -1 : 1;
    });

    return project;
  }

  async createOrUpdate(
    user: User, 
    data: { id?: string, name?: string, description: string, keywords: string[], extensions: string[], matchMode: string }
  ): Promise<Project> {
    let project: Project;

    if (data.id) {
      project = await this.findOne(data.id, user);
    } else {
      project = this.projectsRepository.create({
        user,
        name: data.name || data.description.substring(0, 30) + '...',
      });
    }

    project.description = data.description;
    project.keywords = data.keywords;
    project.extensions = data.extensions;
    project.matchMode = data.matchMode;

    return this.projectsRepository.save(project);
  }

  async addSuggestions(project: Project, domains: any[]): Promise<void> {
    const suggestions = domains.map(d => {
      return this.suggestionsRepository.create({
        project,
        domainName: d.name,
        availability: d.allExtensions,
      });
    });

    await this.suggestionsRepository.save(suggestions);
  }

  async toggleFavorite(suggestionId: string, user: User): Promise<boolean> {
    const suggestion = await this.suggestionsRepository.findOne({
      where: { id: suggestionId, project: { user: { id: user.id } } },
    });

    if (!suggestion) {
      throw new NotFoundException('Suggestion non trouvée');
    }

    suggestion.isFavorite = !suggestion.isFavorite;
    await this.suggestionsRepository.save(suggestion);
    return suggestion.isFavorite;
  }
}