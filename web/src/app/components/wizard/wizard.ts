import { Component, signal, computed, OnInit, HostListener, ChangeDetectorRef, ApplicationRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
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
import { Dialog } from 'primeng/dialog';
import { SplitButton } from 'primeng/splitbutton';
import { Toast } from 'primeng/toast';
import { MenuItem, ConfirmationService, MessageService } from 'primeng/api';
import { UserService } from '../../services/user';
import { ProjectService } from '../../services/project';
import { FeedbackService } from '../../services/feedback';
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
    Dialog,
    SplitButton,
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

  // ─── US-032 : Naming styles (local mode only) ─────────────
  descriptiveNames = signal(false);
  culturalNames = signal(false);
  // ────────────────────────────────────────────────────────────

  private readonly EXT_TO_LOCALE: Record<string, string> = {
    '.fr': 'fr', '.be': 'fr', '.ch': 'fr',
    '.de': 'de', '.at': 'de',
    '.es': 'es', '.mx': 'es', '.ar': 'es', '.co': 'es',
    '.it': 'it',
    '.nl': 'nl',
    '.pt': 'pt', '.br': 'pt',
    '.pl': 'pl',
    '.se': 'sv',
    '.dk': 'da',
    '.fi': 'fi',
    '.no': 'no',
    '.ro': 'ro',
    '.cz': 'cs',
    '.hu': 'hu',
    '.tr': 'tr',
    '.jp': 'ja',
    '.cn': 'zh',
    '.ru': 'ru',
    '.uk': 'en', '.gb': 'en', '.au': 'en', '.us': 'en', '.ca': 'en', '.nz': 'en',
  };

  readonly LOCALE_LABELS: Record<string, string> = {
    cs: 'Čeština',
    da: 'Dansk',
    de: 'Deutsch',
    en: 'English',
    es: 'Español',
    fi: 'Suomi',
    fr: 'Français',
    hu: 'Magyar',
    it: 'Italiano',
    nl: 'Nederlands',
    no: 'Norsk',
    pl: 'Polski',
    pt: 'Português',
    ro: 'Română',
    sv: 'Svenska',
    tr: 'Türkçe',
    ja: '日本語',
    zh: '中文',
    ru: 'Русский',
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
  selectedExtensions = signal<string[]>(['.com']);
  matchMode = signal('all');
  matchOptions = signal<any[]>([]);

  // Étape 3
  domains = signal<any[]>([]);
  totalChecked = signal(0);
  recheckLoading = signal(false);
  copiedDomain = signal<string | null>(null);
  newDomainName = signal('');
  addingDomain = signal(false);
  expandedAnalysisId = signal<string | null>(null);
  showPickDialog = signal(false);
  pickBestLoading = signal(false);
  pickBestResult = signal<{ recommended: string; reason: string } | null>(null);
  pickBestCandidates = signal<string[]>([]);
  private pickBestKey = signal<string | null>(null);
  showDisliked = signal(false);
  likedDomains = computed(() => this.domains().filter(d => d.rating === 'liked'));

  pickMenuItems = computed<MenuItem[]>(() => [
    {
      label: this.translate.instant('WIZARD.STEP3.PICK_ALL'),
      icon: 'pi pi-list',
      command: () => this.helpMePick('all'),
    },
    {
      label: this.translate.instant('WIZARD.STEP3.PICK_FAVOURITES'),
      icon: 'pi pi-thumbs-up',
      disabled: this.likedDomains().length < 2,
      command: () => this.helpMePick('favourites'),
    },
  ]);
  streamProgress = signal<{ phase: 'generating' | 'checking'; name?: string; checked: number; found: number } | null>(null);

  // ─── US-022 : Buy on registrar ────────────────────
  readonly REGISTRARS = [
    {
      label: 'OVH',
      url: (n: string, exts: string[]) => {
        const d = exts.length === 1 ? `${n}${exts[0]}` : n;
        return `https://www.ovhcloud.com/fr/domains/domain-name-checker/?q=${d}&utm_source=namorama&utm_medium=referral&utm_campaign=domain_search`;
      },
    },
    {
      label: 'Namecheap',
      url: (n: string, exts: string[]) => {
        const d = exts.length === 1 ? `${n}${exts[0]}` : n;
        return `https://www.namecheap.com/domains/registration/results.aspx?domain=${d}&utm_source=namorama&utm_medium=referral&utm_campaign=domain_search`;
      },
    },
    {
      label: 'GoDaddy',
      url: (n: string, exts: string[]) => {
        const d = exts.length === 1 ? `${n}${exts[0]}` : n;
        return `https://www.godaddy.com/domainsearch/find?domainToCheck=${d}&utm_source=namorama&utm_medium=referral&utm_campaign=domain_search`;
      },
    },
    {
      label: 'Gandi',
      url: (n: string, exts: string[]) => {
        const d = exts.length === 1 ? `${n}${exts[0]}` : n;
        return `https://shop.gandi.net/fr/domain/suggest?search=${d}&utm_source=namorama&utm_medium=referral&utm_campaign=domain_search`;
      },
    },
    {
      label: 'Hostinger',
      url: (n: string, exts: string[]) => {
        const d = exts.length === 1 ? `${n}${exts[0]}` : n;
        return `https://www.hostinger.com/fr/nom-de-domaine-disponible?domain=${d}&utm_source=namorama&utm_medium=referral&utm_campaign=domain_search`;
      },
    },
  ];

  openReg = signal<string | null>(null);

  toggleReg(name: string, event: MouseEvent) {
    event.stopPropagation();
    this.openReg.set(this.openReg() === name ? null : name);
  }

  @HostListener('document:click')
  closeReg() {
    this.openReg.set(null);
  }

  private readonly SEARCH_TIMEOUT_MS = 30_000;
  private searchTimeoutHandle: ReturnType<typeof setTimeout> | null = null;

  filteredDomains = computed(() => {
    const mode = this.matchMode();
    const exts = this.selectedExtensions();
    const showDisliked = this.showDisliked();
    return this.domains().filter(d => {
      if (!showDisliked && d.rating === 'disliked') return false;
      if (exts.length === 0) return true;
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
    private appRef: ApplicationRef,
    private sanitizer: DomSanitizer,
    private feedbackService: FeedbackService,
  ) {}

  openFeedback() {
    this.feedbackService.openDialog();
  }

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
      this.selectedExtensions.set(state.selectedExtensions || ['.com']);
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
          style: s.style || 'standard',
          allExtensions: s.availability,
          rating: s.rating ?? 'neutral',
          analysis: s.analysis ?? null,
          analysisPending: false,
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
    this.selectedExtensions.set(['.com']);
    this.matchMode.set('all');
    this.isLocal.set(false);
    this.localeOverride.set('');
    this.descriptiveNames.set(false);
    this.culturalNames.set(false);
    this.activeIndex.set(0);
    this.maxActiveIndex.set(0);
    if (!this.isLoggedIn()) this.showLanding.set(true);
    this.router.navigate(['/']);
    this.cdr.detectChanges();
  }

  private readonly ratingOrder: Record<string, number> = { liked: 0, neutral: 1, disliked: 2 };

  setRating(result: any, rating: 'liked' | 'disliked' | 'neutral') {
    if (!result.id) return;

    // Mise à jour optimiste immédiate
    const previousRating = result.rating;
    result.rating = rating;
    this.domains.update(d => [...d].sort((a, b) => (this.ratingOrder[a.rating] ?? 1) - (this.ratingOrder[b.rating] ?? 1)));
    this.cdr.detectChanges();

    this.projectService.setRating(result.id, rating).subscribe({
      next: (res) => {
        result.rating = res.rating;
        // US-005 — déclencher l'analyse IA si liked et pas encore analysé
        if (res.rating === 'liked' && !result.analysis && !result.analysisPending) {
          setTimeout(() => {
            result.analysisPending = true;
            this.cdr.detectChanges();
            this.domainService.analyzeName(result.id, this.translate.currentLang).subscribe({
              next: (r) => {
                result.analysis = r.analysis;
                result.analysisPending = false;
                this.cdr.detectChanges();
              },
              error: () => { result.analysisPending = false; this.cdr.detectChanges(); },
            });
          });
        }
      },
      error: () => {
        result.rating = previousRating;
        this.domains.update(d => [...d].sort((a, b) => (this.ratingOrder[a.rating] ?? 1) - (this.ratingOrder[b.rating] ?? 1)));
        this.cdr.detectChanges();
      }
    });
  }

  helpMePick(mode: 'all' | 'favourites' = 'all') {
    const candidates = mode === 'favourites' ? this.likedDomains() : this.filteredDomains();
    if (candidates.length < 2) return;

    const currentKey = mode + ':' + candidates.map(d => d.name).sort().join('|');

    // Résultat déjà en cache → afficher directement
    if (this.pickBestKey() === currentKey && this.pickBestResult()) {
      this.showPickDialog.set(true);
      return;
    }

    this.pickBestResult.set(null);
    this.pickBestLoading.set(true);
    this.showPickDialog.set(true);
    this.pickBestCandidates.set(candidates.map(d => d.name));

    const suggestions = candidates.map(d => ({
      name: d.name,
      analysis: d.analysis ?? null,
      extensions: d.allExtensions,
    }));

    this.domainService.pickBest(suggestions, this.translate.currentLang).subscribe({
      next: (result) => {
        this.pickBestResult.set(result);
        this.pickBestKey.set(currentKey);
        this.pickBestLoading.set(false);
        this.cdr.detectChanges();
      },
      error: () => {
        this.pickBestLoading.set(false);
        this.showPickDialog.set(false);
        this.cdr.detectChanges();
      },
    });
  }

  copyDomainName(name: string) {
    navigator.clipboard.writeText(name).then(() => {
      this.copiedDomain.set(name);
      setTimeout(() => this.copiedDomain.set(null), 1500);
    });
  }

  getDomainByName(name: string): any {
    return this.domains().find(d => d.name === name) ?? null;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  parseAnalysisScore(analysis: string | null): number {
    if (!analysis) return 0;
    try {
      const parsed = JSON.parse(analysis);
      if (parsed.scores) {
        const vals = Object.values(parsed.scores) as number[];
        if (vals.length > 0) return vals.reduce((a: number, b: number) => a + b, 0) / vals.length;
      }
    } catch {}
    // Ancien format texte : chercher des patterns comme "4/5", ": 4 —", "★★★★"
    const numericMatches = analysis.match(/:\s*([1-5])(?:\/5)?\s*[—–-]/g);
    if (numericMatches && numericMatches.length > 0) {
      const scores = numericMatches.map(m => parseInt(m.match(/([1-5])/)?.[1] ?? '0'));
      return scores.reduce((a, b) => a + b, 0) / scores.length;
    }
    // Fallback : compter les ★ (pleines ou avec ☆)
    const lines = analysis.split('\n');
    const criteriaScores: number[] = [];
    for (const line of lines) {
      const stars = (line.match(/★/g) || []).length;
      const total = (line.match(/[★☆]/g) || []).length;
      if (total >= 1 && total <= 5 && stars >= 1) criteriaScores.push(stars);
    }
    if (criteriaScores.length > 0) {
      return criteriaScores.reduce((a, b) => a + b, 0) / criteriaScores.length;
    }
    return 0;
  }

  getStarArray(score: number): boolean[] {
    const full = Math.round(score);
    return Array.from({ length: 5 }, (_, i) => i < full);
  }

  parseAnalysisHtml(analysis: string | null): SafeHtml {
    if (!analysis) return this.sanitizer.bypassSecurityTrustHtml('');
    try {
      const parsed = JSON.parse(analysis);
      if (parsed.scores && parsed.comments) {
        const scoreColor = (s: number) =>
          s <= 1 ? '#ef4444' : s === 2 ? '#f97316' : s === 3 ? '#f59e0b' : s === 4 ? '#84cc16' : '#16a34a';

        const criteria: [string, string][] = [
          ['memorability', 'Mémorabilité'],
          ['pronunciation', 'Prononciation'],
          ['international', 'Portée internationale'],
          ['seo', 'SEO'],
          ['distinctiveness', 'Distinctivité'],
        ];

        const cells = criteria.map(([key, label]) => {
          const score: number = parsed.scores[key] ?? 0;
          const comment: string = this.escapeHtml(parsed.comments[key] ?? '');
          const safeLabel = this.escapeHtml(label);
          const color = scoreColor(score);
          const pct = (score / 5) * 100;
          return `
            <div style="min-width:0">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.2rem">
                <span style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#6b7280">${safeLabel}</span>
                <span style="font-size:0.78rem;font-weight:800;color:${color}">${score}/5</span>
              </div>
              <div style="height:4px;background:#e5e7eb;border-radius:9999px;margin-bottom:0.3rem">
                <div style="height:100%;width:${pct}%;background:${color};border-radius:9999px"></div>
              </div>
              <span style="font-size:0.75rem;color:#6b7280;line-height:1.4">${comment}</span>
            </div>`;
        }).join('');

        const grid = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:0.75rem 1.25rem">${cells}</div>`;

        const safeStrengths = parsed.strengths ? this.escapeHtml(parsed.strengths) : '';
        const safeWatchout = parsed.watchout ? this.escapeHtml(parsed.watchout) : '';
        const footer = (safeStrengths || safeWatchout) ? `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;border-top:1px solid #e5e7eb;margin-top:0.75rem;padding-top:0.625rem">
            ${safeStrengths ? `<div style="font-size:0.76rem;color:#374151;line-height:1.5"><span style="font-weight:700">✅ Points forts</span><br>${safeStrengths}</div>` : ''}
            ${safeWatchout  ? `<div style="font-size:0.76rem;color:#374151;line-height:1.5"><span style="font-weight:700">⚠️ Attention</span><br>${safeWatchout}</div>`  : ''}
          </div>` : '';

        return this.sanitizer.bypassSecurityTrustHtml(grid + footer);
      }
    } catch {}
    // Ancien format texte — échapper d'abord, puis restaurer le balisage autorisé
    const escaped = this.escapeHtml(analysis);
    const html = escaped
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/★/g, '<span style="color:#f59e0b">★</span>')
      .replace(/☆/g, '<span style="color:#d1d5db">☆</span>')
      .replace(/\n/g, '<br>');
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  toggleAnalysis(id: string) {
    this.expandedAnalysisId.set(this.expandedAnalysisId() === id ? null : id);
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
      this.persistExtensions();
      this.recheckIfNeeded();
    }
    this.newExtension.set('');
    this.cdr.detectChanges();
  }

  removeExtension(ext: string) {
    this.selectedExtensions.update(e => e.filter(item => item !== ext));
    this.persistExtensions();
    this.recheckIfNeeded();
    this.cdr.detectChanges();
  }

  private persistExtensions() {
    if (this.projectId()) {
      this.projectService.updateProject(this.projectId()!, { extensions: this.selectedExtensions() }).subscribe();
    }
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

        // Persister les nouvelles disponibilités pour toutes les suggestions sauvegardées
        const toSave = this.domains()
          .filter(d => d.id)
          .map(d => ({ id: d.id as string, availability: d.allExtensions as Record<string, boolean> }));
        if (toSave.length > 0) {
          this.projectService.updateSuggestionsAvailability(toSave).subscribe();
        }

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

    this.domainService.generateKeywords(descToUse, this.effectiveLocale() ?? this.translate.currentLang).subscribe({
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

  private meetsMatchMode(allExtensions: Record<string, boolean | null>): boolean {
    const exts = this.selectedExtensions();
    const known = exts.filter(ext => allExtensions[ext] !== null && allExtensions[ext] !== undefined);
    if (known.length === 0) return true;
    const available = known.filter(ext => allExtensions[ext] === true);
    return this.matchMode() === 'all' ? available.length === known.length : available.length > 0;
  }

  addManualDomain() {
    // Sépare par espace, virgule ou point-virgule ; normalise chaque token
    const newNames = [
      ...new Set(
        this.newDomainName().trim().toLowerCase()
          .split(/[\s,;]+/)
          .filter(t => t.length > 0)
          .map(t => t.replace(/^\./, '').replace(/\.[a-z]{2,10}$/, ''))
          .filter(n => n.length > 0)
          .filter(n => !this.domains().some(d => d.name === n)) // exclure doublons
      )
    ];

    if (newNames.length === 0) {
      this.newDomainName.set('');
      return;
    }

    // Lignes temporaires avec spinners — auto-liked immédiat (US-025)
    const tempRows = newNames.map(name => ({
      id: null as string | null,
      name,
      allExtensions: Object.fromEntries(this.selectedExtensions().map(ext => [ext, null])),
      rating: 'liked' as const,
      isManual: true,
      analysisPending: false,
      analysis: null as string | null,
    }));
    this.domains.update(d => [...d, ...tempRows].sort((a, b) => (this.ratingOrder[a.rating] ?? 1) - (this.ratingOrder[b.rating] ?? 1)));
    this.newDomainName.set('');
    this.addingDomain.set(true);
    this.cdr.detectChanges();

    this.domainService.recheckDomains(newNames, this.selectedExtensions()).subscribe({
      next: (res) => {
        // Mettre à jour les lignes avec la vraie disponibilité
        this.domains.update(list =>
          list.map(d => {
            if (!d.isManual || !newNames.includes(d.name)) return d;
            const checked = res.domains.find((r: any) => r.name === d.name);
            return checked ? { ...d, allExtensions: checked.allExtensions } : d;
          })
        );

        // Avertir pour les noms qui ne remplissent pas les critères du filtre actif
        const hidden = res.domains.filter((r: any) =>
          newNames.includes(r.name) && !this.meetsMatchMode(r.allExtensions)
        );
        if (hidden.length > 0) {
          const names = hidden.map((r: any) => r.name).join(', ');
          this.translate.get(['WIZARD.STEP3.MANUAL_NOT_AVAILABLE', 'WIZARD.STEP3.MANUAL_NOT_AVAILABLE_SUMMARY'],
            { names }).subscribe(t => {
            this.messageService.add({
              severity: 'warn',
              summary: t['WIZARD.STEP3.MANUAL_NOT_AVAILABLE_SUMMARY'],
              detail: t['WIZARD.STEP3.MANUAL_NOT_AVAILABLE'].replace('{{names}}', names),
              life: 6000,
            });
          });
        }

        // Sauvegarder dans le projet + auto-favourite + analyse IA (US-025)
        if (this.projectId()) {
          res.domains.forEach((r: any) => {
            if (!newNames.includes(r.name)) return;
            this.projectService.addSuggestion(this.projectId()!, r.name, r.allExtensions as Record<string, boolean>).subscribe({
              next: (saved) => {
                this.domains.update(list =>
                  list.map(d => d.name === r.name && d.isManual ? { ...d, id: saved.id } : d)
                );
                // Persister le rating liked côté serveur puis déclencher l'analyse IA
                this.projectService.setRating(saved.id, 'liked').subscribe({
                  next: () => {
                    const domain = this.domains().find(d => d.id === saved.id);
                    if (domain && !domain.analysis && !domain.analysisPending) {
                      setTimeout(() => {
                        domain.analysisPending = true;
                        this.cdr.detectChanges();
                        this.domainService.analyzeName(saved.id, this.translate.currentLang).subscribe({
                          next: (a) => {
                            domain.analysis = a.analysis;
                            domain.analysisPending = false;
                            this.cdr.detectChanges();
                          },
                          error: () => { domain.analysisPending = false; this.cdr.detectChanges(); },
                        });
                      });
                    }
                  },
                });
              },
            });
          });
        }

        this.addingDomain.set(false);
        this.cdr.detectChanges();
      },
      error: () => {
        this.addingDomain.set(false);
        this.domains.update(list => list.filter(d => !newNames.includes(d.name) || !d.isManual));
        this.cdr.detectChanges();
      },
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
        pendingSearch: true,
      };
      localStorage.setItem('wizard_state', JSON.stringify(state));
      this.keycloak.login();
      return;
    }

    if (!append) this.domains.set([]);
    this.loading.set(true);
    this.streamProgress.set({ phase: 'generating', checked: 0, found: 0 });
    this.startSearchTimeout();
    this.cdr.detectChanges();

    try {
      await this.keycloak.updateToken(30);
    } catch {
      await this.keycloak.login();
      return;
    }
    const token = await this.keycloak.getToken();

    this.domainService.searchDomainsStream({
      description: this.refinedDescription() || this.description(),
      keywords: this.keywords(),
      extensions: this.selectedExtensions(),
      matchMode: this.matchMode(),
      projectId: this.projectId() || undefined,
      projectName: this.projectName() || undefined,
      locale: this.effectiveLocale(),
      // US-015 — lors d'un append, exclure tous les noms déjà évalués
      excludeNames: append ? this.domains().map(d => d.name) : [],
      // US-032 — naming styles (local mode only)
      descriptiveNames: this.isLocal() ? this.descriptiveNames() : false,
      culturalNames: this.isLocal() ? this.culturalNames() : false,
      // US-046 — feedback utilisateur pour affiner la génération suivante
      likedNames: this.domains().filter(d => d.rating === 'liked').map(d => d.name),
      dislikedNames: this.domains().filter(d => d.rating === 'disliked').map(d => d.name),
    }, token).subscribe({
      next: (event: any) => {
        this.clearSearchTimeout();
        this.startSearchTimeout();

        if (event.type === 'generating') {
          this.streamProgress.update(p => p ? { ...p, phase: 'generating' } : null);

        } else if (event.type === 'candidate') {
          this.streamProgress.update(p => p
            ? { ...p, phase: 'checking', name: event.name, checked: event.checkedSoFar }
            : null);

        } else if (event.type === 'result') {
          const domain = { id: null as string | null, name: event.domain.name, style: event.domain.style || 'standard', allExtensions: event.domain.allExtensions, rating: 'neutral' as const };
          this.domains.update(d => [...d, domain]);
          this.streamProgress.update(p => p ? { ...p, found: this.domains().length } : null);

        } else if (event.type === 'done') {
          this.totalChecked.set(event.totalChecked || 0);
          // Mettre à jour les IDs des suggestions sauvegardées
          if (event.savedDomains?.length) {
            this.domains.update(list => list.map(d => {
              const saved = event.savedDomains.find((s: any) => s.name === d.name);
              return saved ? { ...d, id: saved.id } : d;
            }));
          }
          if (event.projectId) {
            this.projectId.set(event.projectId);
            if (this.router.url !== `/projects/${event.projectId}`) {
              this.router.navigate(['/projects', event.projectId], { replaceUrl: true });
            }
          }
          if (event.remainingCredits !== undefined) {
            this.userService.updateCredits(event.remainingCredits);
          }
          this.projectService.refreshProjects().subscribe();

        } else if (event.type === 'error') {
          this.streamProgress.set(null);
          this.loading.set(false);
        }

        this.cdr.detectChanges();
      },
      complete: () => {
        this.streamProgress.set(null);
        this.loading.set(false);
        this.clearSearchTimeout();
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.streamProgress.set(null);
        this.loading.set(false);
        this.clearSearchTimeout();
        if (err.status === 403) this.projectService.showCreditDialog.set(true);
        this.cdr.detectChanges();
      },
    });
  }

  }

  