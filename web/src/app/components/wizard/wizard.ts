import { Component, signal, computed, OnInit, ChangeDetectorRef, ApplicationRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomainService } from '../../services/domain';
import { KeycloakService } from 'keycloak-angular';
import { Router, ActivatedRoute } from '@angular/router';
import { Steps } from 'primeng/steps';
import { Card } from 'primeng/card';
import { Button } from 'primeng/button';
import { Textarea } from 'primeng/textarea';
import { InputText } from 'primeng/inputtext';
import { Chip } from 'primeng/chip';
import { ProgressSpinner } from 'primeng/progressspinner';
import { TableModule } from 'primeng/table';
import { SelectButton } from 'primeng/selectbutton';
import { Select } from 'primeng/select';
import { Drawer } from 'primeng/drawer';
import { Tooltip } from 'primeng/tooltip';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { Toast } from 'primeng/toast';
import { MenuItem, ConfirmationService, MessageService } from 'primeng/api';
import { UserService } from '../../services/user';
import { ProjectService } from '../../services/project';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-wizard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    Steps,
    Card,
    Button,
    Textarea,
    InputText,
    Chip,
    ProgressSpinner,
    TableModule,
    SelectButton,
    Select,
    Drawer,
    Tooltip,
    ConfirmDialog,
    Toast,
    TranslateModule
  ],
  templateUrl: './wizard.html',
  styleUrl: './wizard.css'
})
export class WizardComponent implements OnInit {
  items: MenuItem[] = [];

  // ─── US-001 : International / Local ───────────────────────
  isLocal = signal(false);
  localeOverride = signal<string>('');

  private readonly EXT_TO_LOCALE: Record<string, string> = {
    '.fr': 'fr', '.be': 'fr', '.ch': 'fr',
    '.de': 'de', '.at': 'de',
    '.es': 'es', '.mx': 'es', '.ar': 'es', '.co': 'es',
    '.it': 'it',
    '.nl': 'nl',
    '.pt': 'pt', '.br': 'pt',
    '.pl': 'pl',
    '.jp': 'ja',
    '.cn': 'zh',
    '.ru': 'ru',
    '.uk': 'en', '.gb': 'en', '.au': 'en', '.us': 'en', '.ca': 'en',
  };

  readonly LOCALE_LABELS: Record<string, string> = {
    fr: 'Français', de: 'Deutsch', es: 'Español', it: 'Italiano',
    nl: 'Nederlands', pt: 'Português', pl: 'Polski',
    ja: '日本語', zh: '中文', ru: 'Русский', en: 'English',
  };

  readonly LOCALE_OPTIONS = Object.entries(this.LOCALE_LABELS).map(([value, label]) => ({ value, label }));

  detectedLocale = computed(() => {
    for (const ext of this.selectedExtensions()) {
      const code = this.EXT_TO_LOCALE[ext];
      if (code) return code;
    }
    return null;
  });

  effectiveLocale = computed(() => {
    if (!this.isLocal()) return null;
    return this.localeOverride() || this.detectedLocale() || null;
  });
  // ────────────────────────────────────────────────────────────

  landingBenefits = [
    { icon: 'pi pi-sparkles',   titleKey: 'LANDING.B1_TITLE', descKey: 'LANDING.B1_DESC' },
    { icon: 'pi pi-check-circle', titleKey: 'LANDING.B2_TITLE', descKey: 'LANDING.B2_DESC' },
    { icon: 'pi pi-heart',      titleKey: 'LANDING.B3_TITLE', descKey: 'LANDING.B3_DESC' },
    { icon: 'pi pi-globe',      titleKey: 'LANDING.B4_TITLE', descKey: 'LANDING.B4_DESC' },
  ];

  activeIndex = signal(0);
  maxActiveIndex = signal(0);
  loading = signal(false);
  isLoggedIn = signal(false);
  showLanding = signal(false);

  // Projets
  projectId = signal<string | null>(null);
  projectName = signal('');
  isEditingName = signal(false);

  // Étape 1
  description = signal('');
  refinedDescription = signal('');

  // Étape 2
  keywords = signal<string[]>([]);
  newKeyword = signal('');
  
  newExtension = signal('');
  selectedExtensions = signal<string[]>(['.com', '.net']);
  matchMode = signal('all');
  matchOptions = signal<any[]>([]);

  // Étape 3
  domains = signal<any[]>([]);
  totalChecked = signal(0);
  recheckLoading = signal(false);
  copiedDomain = signal<string | null>(null);

  private readonly SEARCH_TIMEOUT_MS = 30_000;
  private searchTimeoutHandle: ReturnType<typeof setTimeout> | null = null;

  filteredDomains = computed(() => {
    const mode = this.matchMode();
    const exts = this.selectedExtensions();
    if (exts.length === 0) return this.domains();
    return this.domains().filter(d => {
      // Ignorer les extensions en cours de vérification (null) dans le filtre
      const knownExts = exts.filter(ext => d.allExtensions?.[ext] !== null && d.allExtensions?.[ext] !== undefined);
      if (knownExts.length === 0) return true; // toutes en cours → on garde la ligne
      const available = knownExts.filter(ext => d.allExtensions[ext] === true);
      return mode === 'all' ? available.length === knownExts.length : available.length > 0;
    });
  });

  constructor(
    public domainService: DomainService,
    public userService: UserService,
    public projectService: ProjectService,
    public keycloak: KeycloakService,
    private translate: TranslateService,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private route: ActivatedRoute,
    private confirmationService: ConfirmationService,
    private messageService: MessageService,
    private appRef: ApplicationRef
  ) {}

  async ngOnInit() {
    this.isLoggedIn.set(await this.keycloak.isLoggedIn());
    // Afficher la landing uniquement aux visiteurs non connectés sur la page d'accueil
    if (!this.isLoggedIn() && !this.route.snapshot.params['id']) {
      this.showLanding.set(true);
    }
    this.updateLabels();
    this.translate.onLangChange.subscribe(() => this.updateLabels());

    // Écouter les demandes de reset (depuis le menu global)
    this.projectService.resetWizard$.subscribe(() => {
      this.resetProject();
    });

    // S'abonner aux changements de paramètres d'URL
    this.route.params.subscribe(params => {
      const id = params['id'];
      if (id && id !== this.projectId()) {
        this.loadProject(id);
      }
    });

    const savedState = localStorage.getItem('wizard_state');
    if (savedState) {
      const state = JSON.parse(savedState);
      this.description.set(state.description);
      this.projectName.set(state.projectName || '');
      this.refinedDescription.set(state.refinedDescription);
      this.keywords.set(state.keywords);
      this.selectedExtensions.set(state.selectedExtensions || ['.com', '.net']);
      this.matchMode.set(state.matchMode || 'all');
      this.projectId.set(state.projectId || null);
      localStorage.removeItem('wizard_state');
      
      if (this.isLoggedIn()) {
        if (this.projectId()) {
          this.loadProject(this.projectId()!);
        } else if (state.pendingSearch) {
          // L'utilisateur avait cliqué "Rechercher" avant d'être invité à se connecter
          this.activeIndex.set(2);
          this.maxActiveIndex.set(2);
          this.findDomains();
        } else {
          this.activeIndex.set(1);
          this.maxActiveIndex.set(1);
        }
      }
    }
  }

  updateLabels() {
    this.translate.get([
      'WIZARD.STEPS.DESCRIPTION',
      'WIZARD.STEPS.KEYWORDS',
      'WIZARD.STEPS.DOMAINS',
      'WIZARD.STEP2.MATCH_ANY',
      'WIZARD.STEP2.MATCH_ALL'
    ]).subscribe(res => {
      this.items = [
        { label: res['WIZARD.STEPS.DESCRIPTION'] },
        { label: res['WIZARD.STEPS.KEYWORDS'] },
        { label: res['WIZARD.STEPS.DOMAINS'] }
      ];
      this.matchOptions.set([
        { label: res['WIZARD.STEP2.MATCH_ANY'], value: 'any' },
        { label: res['WIZARD.STEP2.MATCH_ALL'], value: 'all' }
      ]);
      this.cdr.detectChanges();
    });
  }

  startFromLanding() {
    this.showLanding.set(false);
  }

  goToExtensions() {
    this.nextStep(); // step 1 (keywords) → step 2 (extensions)
  }

  // Navigation
  nextStep() {
    this.activeIndex.update(val => val + 1);
    this.maxActiveIndex.set(Math.max(this.maxActiveIndex(), this.activeIndex()));
    this.cdr.detectChanges();
  }

  prevStep() {
    this.activeIndex.update(val => val - 1);
    this.cdr.detectChanges();
  }

  onStepChange(index: number) {
    if (index <= this.maxActiveIndex()) {
      this.activeIndex.set(index);
      this.cdr.detectChanges();
    }
  }

  finishEditingName() {
    this.isEditingName.set(false);
    if (this.projectId() && this.projectName()) {
      this.projectService.updateProject(this.projectId()!, { name: this.projectName() }).subscribe(() => {
        this.projectService.refreshProjects().subscribe();
      });
    }
  }

  // Gestion des projets
  openProjects() {
    this.projectService.refreshProjects().subscribe();
    this.projectService.showDrawer.set(true);
    this.cdr.detectChanges();
  }

  loadProject(id: string) {
    this.projectService.showDrawer.set(false);
    this.loading.set(true);
    this.cdr.detectChanges();

    this.projectService.getProject(id).subscribe({
      next: (project) => {
        this.projectId.set(project.id);
        this.projectName.set(project.name);
        this.description.set(project.description);
        this.keywords.set(project.keywords || []);
        this.selectedExtensions.set(project.extensions);
        this.matchMode.set(project.matchMode);
        
        this.domains.set(project.suggestions.map((s: any) => ({
          id: s.id,
          name: s.domainName,
          allExtensions: s.availability,
          isFavorite: s.isFavorite
        })));

        this.activeIndex.set(2);
        this.maxActiveIndex.set(2);
        this.loading.set(false);
        
        if (this.router.url !== `/projects/${id}`) {
          this.router.navigate(['/projects', id], { replaceUrl: true });
        }
        
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading.set(false);
        this.cdr.detectChanges();
      }
    });
  }

  deleteProject(event: Event, id: string) {
    event.stopPropagation();
    this.translate.get(['PROJECTS.CONFIRM_DELETE', 'PROJECTS.DELETE', 'PROJECTS.SUCCESS', 'PROJECTS.DELETE_SUCCESS']).subscribe(res => {
      this.confirmationService.confirm({
        target: event.target as EventTarget,
        message: res['PROJECTS.CONFIRM_DELETE'],
        header: res['PROJECTS.DELETE'],
        icon: 'pi pi-exclamation-triangle',
        acceptIcon: "none",
        rejectIcon: "none",
        rejectButtonStyleClass: "p-button-text",
        accept: () => {
          this.projectService.deleteProject(id).subscribe(() => {
            this.projectService.projects.update(list => list.filter(p => p.id !== id));
            if (this.projectId() === id) {
              this.resetProject();
            }
            this.messageService.add({
              severity: 'success',
              summary: res['PROJECTS.SUCCESS'],
              detail: res['PROJECTS.DELETE_SUCCESS']
            });
            this.appRef.tick();
          });
        }
      });
    });
  }

  resetProject() {
    this.projectId.set(null);
    this.projectName.set('');
    this.description.set('');
    this.refinedDescription.set('');
    this.keywords.set([]);
    this.domains.set([]);
    this.newKeyword.set('');
    this.newExtension.set('');
    this.selectedExtensions.set(['.com', '.net']);
    this.matchMode.set('all');
    this.isLocal.set(false);
    this.localeOverride.set('');
    this.activeIndex.set(0);
    this.maxActiveIndex.set(0);
    if (!this.isLoggedIn()) this.showLanding.set(true);
    this.router.navigate(['/']);
    this.cdr.detectChanges();
  }

  toggleFavorite(result: any) {
    if (!result.id) return;

    // Mise à jour optimiste immédiate — l'UI répond sans attendre le serveur
    const previousValue = result.isFavorite;
    result.isFavorite = !result.isFavorite;
    this.domains.update(d => [...d].sort((a, b) => {
      if (a.isFavorite === b.isFavorite) return 0;
      return a.isFavorite ? -1 : 1;
    }));
    this.cdr.detectChanges();

    // Synchronisation en arrière-plan
    this.projectService.toggleFavorite(result.id).subscribe({
      next: (res) => {
        result.isFavorite = res.isFavorite;
      },
      error: () => {
        // Annulation de la mise à jour optimiste en cas d'erreur
        result.isFavorite = previousValue;
        this.domains.update(d => [...d].sort((a, b) => {
          if (a.isFavorite === b.isFavorite) return 0;
          return a.isFavorite ? -1 : 1;
        }));
        this.cdr.detectChanges();
      }
    });
  }

  addKeyword() {
    if (this.newKeyword() && !this.keywords().includes(this.newKeyword())) {
      this.keywords.update(k => [...k, this.newKeyword()]);
      this.newKeyword.set('');
      this.cdr.detectChanges();
    }
  }

  removeKeyword(keyword: string) {
    this.keywords.update(k => k.filter(item => item !== keyword));
    this.cdr.detectChanges();
  }

  addExtension() {
    const raw = this.newExtension().trim().toLowerCase();
    if (!raw) return;

    // Séparer par espace, virgule ou point-virgule
    const tokens = raw.split(/[\s,;]+/).filter(t => t.length > 0);
    const toAdd = tokens
      .map(t => t.startsWith('.') ? t : '.' + t)
      .filter(ext => /^\.[a-z]{2,10}$/.test(ext) && !this.selectedExtensions().includes(ext));

    if (toAdd.length > 0) {
      if (this.selectedExtensions().length === 1 && toAdd.length >= 1) {
        this.matchMode.set('all');
      }
      this.selectedExtensions.update(e => [...e, ...toAdd]);
      this.recheckIfNeeded();
    }
    this.newExtension.set('');
    this.cdr.detectChanges();
  }

  removeExtension(ext: string) {
    this.selectedExtensions.update(e => e.filter(item => item !== ext));
    this.recheckIfNeeded();
    this.cdr.detectChanges();
  }

  recheckIfNeeded() {
    if (this.domains().length > 0 && this.selectedExtensions().length > 0) {
      this.recheckDomains();
    }
  }

  recheckDomains() {
    const names = this.domains().map(d => d.name);
    const extensions = this.selectedExtensions();
    this.recheckLoading.set(true);

    // Initialise les nouvelles extensions à null (indéterminé) pour distinguer
    // "en cours de vérification" de "indisponible confirmé"
    this.domains.update(list =>
      list.map(d => {
        const updated: Record<string, boolean | null> = { ...d.allExtensions };
        for (const ext of extensions) {
          if (!(ext in updated)) updated[ext] = null;
        }
        return { ...d, allExtensions: updated };
      })
    );
    this.cdr.detectChanges();

    this.domainService.recheckDomains(names, extensions).subscribe({
      next: (res) => {
        this.domains.update(list =>
          list.map(d => {
            const updated = res.domains.find(r => r.name === d.name);
            return updated ? { ...d, allExtensions: updated.allExtensions } : d;
          })
        );
        this.recheckLoading.set(false);
        this.appRef.tick();
      },
      error: () => {
        this.recheckLoading.set(false);
        this.translate.get('WIZARD.RECHECK_ERROR').subscribe(msg => {
          this.messageService.add({ severity: 'error', summary: 'Erreur', detail: msg, life: 4000 });
        });
        this.cdr.detectChanges();
      }
    });
  }

  isFullyAvailable(result: any): boolean {
    return this.selectedExtensions().every(ext => result.allExtensions[ext]);
  }

  private startSearchTimeout() {
    this.clearSearchTimeout();
    this.searchTimeoutHandle = setTimeout(() => {
      if (!this.loading()) return;
      this.translate.get(['WIZARD.TIMEOUT.MESSAGE', 'WIZARD.TIMEOUT.KEEP_WAITING', 'WIZARD.TIMEOUT.CANCEL']).subscribe(res => {
        this.confirmationService.confirm({
          message: res['WIZARD.TIMEOUT.MESSAGE'],
          acceptLabel: res['WIZARD.TIMEOUT.KEEP_WAITING'],
          rejectLabel: res['WIZARD.TIMEOUT.CANCEL'],
          acceptIcon: 'none',
          rejectIcon: 'none',
          rejectButtonStyleClass: 'p-button-text',
          accept: () => { /* on continue d'attendre */ },
          reject: () => {
            this.loading.set(false);
            this.activeIndex.set(2);
            this.cdr.detectChanges();
          }
        });
      });
    }, this.SEARCH_TIMEOUT_MS);
  }

  private clearSearchTimeout() {
    if (this.searchTimeoutHandle !== null) {
      clearTimeout(this.searchTimeoutHandle);
      this.searchTimeoutHandle = null;
    }
  }

  copyTable() {
    const exts = this.selectedExtensions();
    const header = ['Domain', ...exts].join('\t');
    const rows = this.filteredDomains().map(d => {
      const cols = exts.map(ext =>
        d.allExtensions[ext] === true ? '✓' : d.allExtensions[ext] === false ? '✗' : '?'
      );
      return [d.name, ...cols].join('\t');
    });
    const text = [header, ...rows].join('\n');
    navigator.clipboard.writeText(text).then(() => {
      this.copiedDomain.set('table');
      setTimeout(() => this.copiedDomain.set(null), 2000);
    });
  }

  // Actions IA
  async refine() {
    this.loading.set(true);
    this.cdr.detectChanges();
    this.domainService.refineDescription(this.description()).subscribe({
      next: (res: { refined: string }) => {
        this.refinedDescription.set(res.refined);
        this.loading.set(false);
        // Suggérer un nom dès que la description est raffinée
        this.autoSuggestName(res.refined);
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading.set(false);
        this.cdr.detectChanges();
      }
    });
  }

  autoSuggestName(description: string) {
    // Ne suggérer que si le nom est vide ou générique
    if (!this.projectName() || this.projectName().includes('...')) {
      this.domainService.suggestProjectName(description).subscribe(res => {
        if (res.suggestedName) {
          this.projectName.set(res.suggestedName);
          this.cdr.detectChanges();
        }
      });
    }
  }

  async goToKeywords() {
    this.loading.set(true);
    this.cdr.detectChanges();
    const descToUse = this.refinedDescription() || this.description();
    
    // Suggérer un nom avant de passer aux mots-clés si ce n'est pas déjà fait
    if (!this.projectName() || this.projectName().includes('...')) {
      this.domainService.suggestProjectName(descToUse).subscribe(res => {
        if (res.suggestedName) this.projectName.set(res.suggestedName);
      });
    }

    this.domainService.generateKeywords(descToUse, this.effectiveLocale()).subscribe({
      next: (res: { keywords: string[] }) => {
        this.keywords.set(res.keywords);
        this.loading.set(false);
        this.nextStep();
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading.set(false);
        this.cdr.detectChanges();
      }
    });
  }

    async findDomains(append = false) {

      if (!this.isLoggedIn()) {

        const state = {

          description: this.description(),

          projectName: this.projectName(),

          refinedDescription: this.refinedDescription(),

          keywords: this.keywords(),

          selectedExtensions: this.selectedExtensions(),

          matchMode: this.matchMode(),

          projectId: this.projectId(),

          pendingSearch: true

        };

        localStorage.setItem('wizard_state', JSON.stringify(state));

        this.keycloak.login();

        return;

      }

  

      this.loading.set(true);
      this.startSearchTimeout();

      this.cdr.detectChanges();

      this.domainService.searchDomains(

        this.refinedDescription() || this.description(), 

        this.keywords(),

        this.selectedExtensions(),

        this.matchMode(),

        this.projectId() || undefined,

        this.projectName() || undefined,

        this.effectiveLocale()

      ).subscribe({

        next: (res: any) => {

          this.totalChecked.set(res.totalChecked || 0);

          

          if (!this.projectId() && res.projectId) {

            this.router.navigate(['/projects', res.projectId], { replaceUrl: true });

          }

          

          this.projectId.set(res.projectId);

  

          const newDomains = res.domains.map((d: any) => ({

            id: d.id,

            name: d.name,

            allExtensions: d.allExtensions,

            isFavorite: false

          }));

  

          if (append) {

            this.domains.update(d => [...d, ...newDomains]);

          } else {

            this.domains.set(newDomains);

          }

          

          if (res.remainingCredits !== undefined) {

            this.userService.updateCredits(res.remainingCredits);

          }

  

          // Rafraîchir la liste globale

          this.projectService.refreshProjects().subscribe();

          

          this.clearSearchTimeout();
          this.loading.set(false);

          this.cdr.detectChanges();

        },

        error: (err: any) => {

          this.clearSearchTimeout();
          this.loading.set(false);

          if (err.status === 403) {

            this.projectService.showCreditDialog.set(true);

          }

          this.cdr.detectChanges();

        }

      });

    }

  }

  