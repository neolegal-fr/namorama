import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Project } from './entities/project.entity';
import { ProjectShare, SharePermission } from './entities/project-share.entity';
import { DomainSuggestion } from './entities/domain-suggestion.entity';
import { User } from '../users/entities/user.entity';
import { lireRetours } from './retours';

/** Ce qu'un compte a le droit de faire sur un projet donné. */
export type ProjectRole = 'owner' | 'write' | 'read';

export interface ProjectAccess {
  project: Project;
  role: ProjectRole;
  /**
   * Compte qui PAIE les crédits consommés sur ce projet — toujours son
   * propriétaire, y compris quand c'est un collaborateur qui agit. Un projet
   * partagé en écriture reste le projet de quelqu'un : c'est sa réserve qui
   * finance les recherches qu'on y lance, décision produit assumée.
   */
  owner: User;
}

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    @InjectRepository(Project)
    private projectsRepository: Repository<Project>,
    @InjectRepository(DomainSuggestion)
    private suggestionsRepository: Repository<DomainSuggestion>,
    @InjectRepository(ProjectShare)
    private sharesRepository: Repository<ProjectShare>,
  ) {}

  /**
   * Droit d'un compte sur un projet — propriétaire, écriture, lecture, ou rien.
   *
   * Le rapprochement d'un partage se fait sur l'ADRESSE, en minuscules : c'est
   * la seule clé qui existe avant que l'invité n'ait un compte. Un compte sans
   * adresse connue (rare, mais possible tant que Keycloak ne l'a pas remontée)
   * ne peut donc recevoir aucun partage — plutôt que de tomber sur une
   * comparaison avec `null` qui ouvrirait tout.
   */
  async accessFor(projectId: string, user: User): Promise<ProjectAccess | null> {
    const project = await this.projectsRepository.findOne({
      where: { id: projectId },
      relations: { suggestions: true, user: true },
    });
    if (!project) return null;

    if (project.user?.id === user.id) return { project, role: 'owner', owner: project.user };

    const email = (user.email ?? '').trim().toLowerCase();
    if (!email) return null;

    const share = await this.sharesRepository.findOne({
      where: { project: { id: projectId }, email },
    });
    if (!share) return null;

    // Première ouverture : on note la date, sans faire échouer la lecture si
    // l'écriture échoue — savoir qu'une invitation a servi n'a jamais valu
    // qu'on refuse d'ouvrir le projet.
    if (!share.acceptedAt) {
      share.acceptedAt = new Date();
      this.sharesRepository.save(share).catch(() => undefined);
    }

    return { project, role: share.permission === 'write' ? 'write' : 'read', owner: project.user };
  }

  /** Projets qu'on m'a partagés, avec le droit associé. */
  async findSharedWith(user: User): Promise<{ project: Project; permission: SharePermission; ownerEmail: string | null }[]> {
    const email = (user.email ?? '').trim().toLowerCase();
    if (!email) return [];

    const shares = await this.sharesRepository.find({
      where: { email },
      relations: { project: { user: true } },
      order: { createdAt: 'DESC' },
    });

    return shares
      .filter((s) => s.project)
      .map((s) => ({
        project: s.project,
        permission: s.permission,
        ownerEmail: s.project.user?.email ?? null,
      }));
  }

  async findAllByUser(user: User): Promise<Project[]> {
    return this.projectsRepository.find({
      where: { user: { id: user.id } },
      order: { updatedAt: 'DESC' },
    });
  }

  /**
   * Un projet lisible par ce compte — le sien, ou un qu'on lui a partagé.
   *
   * `NotFoundException` et non `ForbiddenException` quand l'accès manque : dire
   * « interdit » confirmerait l'existence du projet à qui devine des
   * identifiants.
   */
  async findOne(id: string, user: User): Promise<Project> {
    const acces = await this.accessFor(id, user);
    if (!acces) {
      throw new NotFoundException('Projet non trouvé');
    }
    const project = acces.project;

    const ratingOrder: Record<string, number> = { liked: 0, neutral: 1, disliked: 2 };
    project.suggestions.sort((a, b) => (ratingOrder[a.rating] ?? 1) - (ratingOrder[b.rating] ?? 1));

    return project;
  }

  async createOrUpdate(
    user: User,
    data: { id?: string; name?: string; description: string; keywords: string[]; extensions: string[]; matchMode: string; maxLength?: number; likedExamples?: string[]; dislikedExamples?: string[]; retours?: string[] },
    manager?: EntityManager,
  ): Promise<Project> {
    const repo = manager ? manager.getRepository(Project) : this.projectsRepository;
    let project: Project;

    if (data.id) {
      // Un projet EXISTANT : le droit d'écrire suffit, la propriété n'est pas
      // requise. Filtrer sur le propriétaire faisait échouer toute recherche
      // lancée depuis un projet partagé en écriture — et le partage n'aurait
      // servi qu'à regarder.
      const acces = await this.accessFor(data.id, user);
      if (!acces) throw new NotFoundException('Projet non trouvé');
      if (acces.role === 'read') throw new ForbiddenException('Ce projet vous est partagé en lecture seule');
      const found = await repo.findOne({ where: { id: data.id } });
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
    // Absent = l'utilisateur n'y a pas touché cette fois : on garde la valeur
    // enregistrée, qui reste `null` tant qu'aucun maximum n'a été choisi.
    if (data.maxLength !== undefined) project.maxLength = data.maxLength;
    if (data.likedExamples !== undefined) project.likedExamples = data.likedExamples;
    if (data.dislikedExamples !== undefined) project.dislikedExamples = data.dislikedExamples;
    // Les retours portés par la recherche aboutie. Absents = on garde ceux
    // enregistrés : une recherche lancée sans retour ne les efface pas.
    if (data.retours !== undefined) project.retours = lireRetours(data.retours);

    return repo.save(project);
  }

  async addSuggestions(project: Project, domains: any[], manager?: EntityManager): Promise<DomainSuggestion[]> {
    const repo = manager ? manager.getRepository(DomainSuggestion) : this.suggestionsRepository;

    const suggestions = domains.map(d =>
      repo.create({
        project,
        domainName: d.name,
        availability: d.allExtensions,
        checkedAt: new Date(),
        createdAt: new Date(),
        style: d.style || 'standard',
      }),
    );

    return repo.save(suggestions);
  }

  /**
   * Une suggestion que ce compte a le droit de MODIFIER.
   *
   * Le filtre portait sur le propriétaire du projet ; sur un projet partagé,
   * l'analyse d'un nom retombait donc en « suggestion non trouvée ». On résout
   * maintenant le droit par le projet, partages compris.
   */
  async getSuggestionForUser(id: string, user: User): Promise<DomainSuggestion | null> {
    const suggestion = await this.suggestionsRepository.findOne({
      where: { id },
      relations: { project: true },
    });
    if (!suggestion?.project) return null;
    const acces = await this.accessFor(suggestion.project.id, user);
    if (!acces || acces.role === 'read') return null;
    return suggestion;
  }

  async saveAnalysis(id: string, analysis: string): Promise<void> {
    await this.suggestionsRepository.update(id, { analysis });
  }

  async updateSuggestionsAvailability(updates: { id: string; availability: Record<string, boolean> }[], user: User): Promise<void> {
    await Promise.all(
      updates.map(async ({ id, availability }) => {
        // On vérifie le droit d'écrire AVANT de toucher quoi que ce soit : la
        // liste vient du navigateur, elle peut porter n'importe quel
        // identifiant.
        const suggestion = await this.suggestionsRepository.findOne({
          where: { id },
          relations: { project: true },
        });
        if (!suggestion?.project) return;
        const acces = await this.accessFor(suggestion.project.id, user);
        if (!acces || acces.role === 'read') return; // ni le sien, ni partagé en écriture
        await this.suggestionsRepository.update(id, { availability, checkedAt: new Date() });
      })
    );
  }

  async addManualSuggestion(
    projectId: string,
    user: User,
    domainName: string,
    availability: Record<string, boolean>,
  ): Promise<DomainSuggestion> {
    const { project } = await this.requireWrite(projectId, user);

    // Ignorer si le nom existe déjà dans ce projet
    const existing = await this.suggestionsRepository.findOne({
      where: { project: { id: projectId }, domainName },
    });
    if (existing) return existing;

    const suggestion = this.suggestionsRepository.create({ project, domainName, availability, checkedAt: new Date(), createdAt: new Date() });
    return this.suggestionsRepository.save(suggestion);
  }

  async setRating(suggestionId: string, user: User, rating: 'liked' | 'disliked' | 'neutral'): Promise<'liked' | 'disliked' | 'neutral'> {
    const suggestion = await this.suggestionsRepository.findOne({
      where: { id: suggestionId },
      relations: { project: true },
    });

    if (!suggestion?.project) {
      throw new NotFoundException('Suggestion non trouvée');
    }
    await this.requireWrite(suggestion.project.id, user);

    suggestion.rating = rating;
    await this.suggestionsRepository.save(suggestion);
    return suggestion.rating;
  }

  /**
   * Droit d'écrire, ou refus explicite.
   *
   * Ici `ForbiddenException` se justifie : le projet, l'appelant le voit déjà.
   * Lui répondre « introuvable » sur une modification serait mensonger.
   */
  async requireWrite(id: string, user: User): Promise<ProjectAccess> {
    const acces = await this.accessFor(id, user);
    if (!acces) throw new NotFoundException('Projet non trouvé');
    if (acces.role === 'read') {
      throw new ForbiddenException('Ce projet vous est partagé en lecture seule');
    }
    return acces;
  }

  async update(id: string, user: User, data: Partial<Project>): Promise<Project> {
    const { project } = await this.requireWrite(id, user);
    if (data.name !== undefined) project.name = data.name;
    if (data.description !== undefined) project.description = data.description;
    if (data.keywords !== undefined) project.keywords = data.keywords;
    if (data.extensions !== undefined) project.extensions = data.extensions;
    if (data.matchMode !== undefined) project.matchMode = data.matchMode;
    // Retrait d'une puce : la liste entière, déjà amputée, sans lancer de recherche.
    if (data.retours !== undefined) project.retours = lireRetours(data.retours);
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
