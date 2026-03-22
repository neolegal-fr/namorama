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

    const ratingOrder: Record<string, number> = { liked: 0, neutral: 1, disliked: 2 };
    project.suggestions.sort((a, b) => (ratingOrder[a.rating] ?? 1) - (ratingOrder[b.rating] ?? 1));

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

  async addSuggestions(project: Project, domains: any[], manager?: EntityManager): Promise<DomainSuggestion[]> {
    const repo = manager ? manager.getRepository(DomainSuggestion) : this.suggestionsRepository;

    const suggestions = domains.map(d =>
      repo.create({
        project,
        domainName: d.name,
        availability: d.allExtensions,
        style: d.style || 'standard',
      }),
    );

    return repo.save(suggestions);
  }

  async getSuggestionForUser(id: string, user: User): Promise<DomainSuggestion | null> {
    return this.suggestionsRepository.findOne({
      where: { id, project: { user: { id: user.id } } },
    });
  }

  async saveAnalysis(id: string, analysis: string): Promise<void> {
    await this.suggestionsRepository.update(id, { analysis });
  }

  async updateSuggestionsAvailability(updates: { id: string; availability: Record<string, boolean> }[], user: User): Promise<void> {
    await Promise.all(
      updates.map(async ({ id, availability }) => {
        // Verify the suggestion belongs to the authenticated user before updating
        const suggestion = await this.suggestionsRepository.findOne({
          where: { id, project: { user: { id: user.id } } },
          relations: ['project', 'project.user'],
        });
        if (!suggestion) return; // silently skip suggestions that don't belong to the user
        await this.suggestionsRepository.update(id, { availability });
      })
    );
  }

  async addManualSuggestion(
    projectId: string,
    user: User,
    domainName: string,
    availability: Record<string, boolean>,
  ): Promise<DomainSuggestion> {
    const project = await this.projectsRepository.findOne({
      where: { id: projectId, user: { id: user.id } },
    });
    if (!project) throw new NotFoundException('Projet non trouvé');

    // Ignorer si le nom existe déjà dans ce projet
    const existing = await this.suggestionsRepository.findOne({
      where: { project: { id: projectId }, domainName },
    });
    if (existing) return existing;

    const suggestion = this.suggestionsRepository.create({ project, domainName, availability });
    return this.suggestionsRepository.save(suggestion);
  }

  async setRating(suggestionId: string, user: User, rating: 'liked' | 'disliked' | 'neutral'): Promise<'liked' | 'disliked' | 'neutral'> {
    const suggestion = await this.suggestionsRepository.findOne({
      where: { id: suggestionId, project: { user: { id: user.id } } },
    });

    if (!suggestion) {
      throw new NotFoundException('Suggestion non trouvée');
    }

    suggestion.rating = rating;
    await this.suggestionsRepository.save(suggestion);
    return suggestion.rating;
  }

  async update(id: string, user: User, data: Partial<Project>): Promise<Project> {
    const project = await this.findOne(id, user);
    if (data.name !== undefined) project.name = data.name;
    if (data.description !== undefined) project.description = data.description;
    if (data.keywords !== undefined) project.keywords = data.keywords;
    if (data.extensions !== undefined) project.extensions = data.extensions;
    if (data.matchMode !== undefined) project.matchMode = data.matchMode;
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
