import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomainService } from '../../services/domain';
import { KeycloakService } from 'keycloak-angular';
import { Steps } from 'primeng/steps';
import { Card } from 'primeng/card';
import { Button } from 'primeng/button';
import { Textarea } from 'primeng/textarea';
import { InputText } from 'primeng/inputtext';
import { Chip } from 'primeng/chip';
import { ProgressSpinner } from 'primeng/progressspinner';
import { Dialog } from 'primeng/dialog';
import { InputNumber } from 'primeng/inputnumber';
import { MultiSelect } from 'primeng/multiselect';
import { SelectButton } from 'primeng/selectbutton';
import { Tag } from 'primeng/tag';
import { MenuItem } from 'primeng/api';
import { UserService } from '../../services/user';
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
    Dialog,
    InputNumber,
    MultiSelect,
    SelectButton,
    Tag,
    TranslateModule
  ],
  templateUrl: './wizard.html',
  styleUrl: './wizard.css'
})
export class WizardComponent implements OnInit {
  items: MenuItem[] = [];

  activeIndex = signal(0);
  maxActiveIndex = signal(0);
  loading = signal(false);
  showCreditDialog = signal(false);
  creditsToBuy = signal(100);

  // Étape 1
  description = signal('');
  refinedDescription = signal('');

  // Étape 2
  keywords = signal<string[]>([]);
  newKeyword = signal('');
  
  availableExtensions = [
    { label: '.com', value: '.com' },
    { label: '.net', value: '.net' },
    { label: '.org', value: '.org' },
    { label: '.fr', value: '.fr' },
    { label: '.io', value: '.io' },
    { label: '.ai', value: '.ai' },
    { label: '.app', value: '.app' }
  ];
  selectedExtensions = signal<string[]>(['.com']);
  matchMode = signal('any');
  matchOptions = signal<any[]>([]);

  // Étape 3
  domains = signal<any[]>([]);
  totalChecked = signal(0);

  constructor(
    private domainService: DomainService,
    private userService: UserService,
    private keycloak: KeycloakService,
    private translate: TranslateService
  ) {}

  async ngOnInit() {
    this.updateLabels();
    this.translate.onLangChange.subscribe(() => this.updateLabels());

    // Restaurer l'état après login
    const savedState = localStorage.getItem('wizard_state');
    if (savedState) {
      const state = JSON.parse(savedState);
      this.description.set(state.description);
      this.refinedDescription.set(state.refinedDescription);
      this.keywords.set(state.keywords);
      this.selectedExtensions.set(state.selectedExtensions || ['.com']);
      this.matchMode.set(state.matchMode || 'any');
      localStorage.removeItem('wizard_state');
      
      if (await this.keycloak.isLoggedIn()) {
        this.activeIndex.set(1);
        this.maxActiveIndex.set(1);
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
    });
  }

  nextStep() {
    this.activeIndex.update(val => val + 1);
    this.maxActiveIndex.set(Math.max(this.maxActiveIndex(), this.activeIndex()));
  }

  prevStep() {
    this.activeIndex.update(val => val - 1);
  }

  onStepChange(index: number) {
    if (index <= this.maxActiveIndex()) {
      this.activeIndex.set(index);
    }
  }

  resetProject() {
    this.description.set('');
    this.refinedDescription.set('');
    this.keywords.set([]);
    this.domains.set([]);
    this.selectedExtensions.set(['.com']);
    this.matchMode.set('any');
    this.activeIndex.set(0);
    this.maxActiveIndex.set(0);
  }

  addKeyword() {
    if (this.newKeyword() && !this.keywords().includes(this.newKeyword())) {
      this.keywords.update(k => [...k, this.newKeyword()]);
      this.newKeyword.set('');
    }
  }

  removeKeyword(keyword: string) {
    this.keywords.update(k => k.filter(item => item !== keyword));
  }

  async refine() {
    this.loading.set(true);
    this.domainService.refineDescription(this.description()).subscribe({
      next: (res: { refined: string }) => {
        this.refinedDescription.set(res.refined);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  async goToKeywords() {
    this.loading.set(true);
    const descToUse = this.refinedDescription() || this.description();
    this.domainService.generateKeywords(descToUse).subscribe({
      next: (res: { keywords: string[] }) => {
        this.keywords.set(res.keywords);
        this.loading.set(false);
        this.nextStep();
      },
      error: () => this.loading.set(false)
    });
  }

  async buyCredits() {
    this.userService.addCredits(this.creditsToBuy()).subscribe({
      next: () => {
        this.showCreditDialog.set(false);
      }
    });
  }

  async findDomains(append = false) {
    if (!(await this.keycloak.isLoggedIn())) {
      const state = {
        description: this.description(),
        refinedDescription: this.refinedDescription(),
        keywords: this.keywords(),
        selectedExtensions: this.selectedExtensions(),
        matchMode: this.matchMode()
      };
      localStorage.setItem('wizard_state', JSON.stringify(state));
      this.keycloak.login();
      return;
    }

    this.loading.set(true);
    this.domainService.searchDomains(
      this.refinedDescription() || this.description(), 
      this.keywords(),
      this.selectedExtensions(),
      this.matchMode()
    ).subscribe({
      next: (res: any) => {
        this.totalChecked.set(res.totalChecked || 0);
        if (append) {
          this.domains.update(d => [...new Set([...d, ...res.domains])]);
        } else {
          this.domains.set(res.domains);
          this.nextStep();
        }
        
        if (res.remainingCredits !== undefined) {
          this.userService.updateCredits(res.remainingCredits);
        }
        
        this.loading.set(false);
      },
      error: (err: any) => {
        this.loading.set(false);
        if (err.status === 403) {
          this.showCreditDialog.set(true);
        }
      }
    });
  }
}