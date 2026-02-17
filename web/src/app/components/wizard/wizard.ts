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
import { MenuItem } from 'primeng/api';

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
    ProgressSpinner
  ],
  templateUrl: './wizard.html',
  styleUrl: './wizard.css'
})
export class WizardComponent implements OnInit {
  items: MenuItem[] = [
    { label: 'Description' },
    { label: 'Mots-clés' },
    { label: 'Domaines' }
  ];

  activeIndex = signal(0);
  loading = signal(false);

  // Étape 1
  description = signal('');
  refinedDescription = signal('');

  // Étape 2
  keywords = signal<string[]>([]);
  newKeyword = signal('');

  // Étape 3
  domains = signal<string[]>([]);

  constructor(
    private domainService: DomainService,
    private keycloak: KeycloakService
  ) {}

  async ngOnInit() {
    // Restaurer l'état après login
    const savedState = localStorage.getItem('wizard_state');
    if (savedState) {
      const state = JSON.parse(savedState);
      this.description.set(state.description);
      this.refinedDescription.set(state.refinedDescription);
      this.keywords.set(state.keywords);
      localStorage.removeItem('wizard_state');
      
      if (await this.keycloak.isLoggedIn()) {
        this.activeIndex.set(1); // Retourner à l'étape des mots-clés, prêt à chercher
      }
    }
  }

  nextStep() {
    this.activeIndex.update(val => val + 1);
  }

  prevStep() {
    this.activeIndex.update(val => val - 1);
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
      next: (res) => {
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
      next: (res) => {
        this.keywords.set(res.keywords);
        this.loading.set(false);
        this.nextStep();
      },
      error: () => this.loading.set(false)
    });
  }

  async findDomains() {
    if (!(await this.keycloak.isLoggedIn())) {
      // Sauvegarder l'état avant de rediriger vers le login
      const state = {
        description: this.description(),
        refinedDescription: this.refinedDescription(),
        keywords: this.keywords()
      };
      localStorage.setItem('wizard_state', JSON.stringify(state));
      this.keycloak.login();
      return;
    }

    this.loading.set(true);
    this.domainService.searchDomains(this.refinedDescription() || this.description(), this.keywords()).subscribe({
      next: (res) => {
        this.domains.set(res.domains);
        this.loading.set(false);
        this.nextStep();
      },
      error: () => this.loading.set(false)
    });
  }
}