import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Project } from './entities/project.entity';
import { DomainSuggestion } from './entities/domain-suggestion.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

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

    project.suggestions.sort((a, b) => {
      if (a.isFavorite === b.isFavorite) return 0;
      return a.isFavorite ? -1 : 1;
    });

    return project;
  }

  async createOrUpdate(
    user: User,
    data: { id?: string; name?: string; description: string; keywords: string[]; extensions: string[]; matchMode: string },
    manager?: EntityManager,
  ): Promise<Project> {
    const repo = manager ? manager.getRepository(Project) : this.projectsRepository;
    let project: Project;

    if (data.id) {
      const found = await repo.findOne({ where: { id: data.id, user: { id: user.id } } });
      if (!found) throw new NotFoundException('Projet non trouvé');
      project = found;
    } else {
      project = repo.create({
        user,
        name: data.name || (data.description.substring(0, 30) + '...'),
      });
    }

    if (data.name) {
      project.name = data.name;
    }

    project.description = data.description;
    project.keywords = data.keywords;
    project.extensions = data.extensions;
    project.matchMode = data.matchMode;

    return repo.save(project);
  }

  async addSuggestions(project: Project, domains: any[], manager?: EntityManager): Promise<void> {
    const repo = manager ? manager.getRepository(DomainSuggestion) : this.suggestionsRepository;

    const suggestions = domains.map(d =>
      repo.create({
        project,
        domainName: d.name,
        availability: d.allExtensions,
      }),
    );

    await repo.save(suggestions);
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

  async update(id: string, user: User, data: Partial<Project>): Promise<Project> {
    const project = await this.findOne(id, user);
    Object.assign(project, data);
    return this.projectsRepository.save(project);
  }

  async remove(id: string, user: User): Promise<void> {
    const project = await this.findOne(id, user);
    if (project.suggestions?.length) {
      await this.suggestionsRepository.remove(project.suggestions);
    }
    await this.projectsRepository.remove(project);
  }
}
