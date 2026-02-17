import { Component, signal, OnInit } from '@angular/core';
import { WizardComponent } from './components/wizard/wizard';
import { UserService } from './services/user';
import { KeycloakService } from 'keycloak-angular';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, WizardComponent],
  template: `
    <main class="min-h-screen bg-gray-50">
      <header class="bg-white shadow-sm py-4">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 class="text-2xl font-bold text-blue-600 cursor-pointer" (click)="reload()">Namespoter</h1>
          <div class="flex items-center gap-4" *ngIf="isLoggedIn()">
             <span class="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
                Crédits: {{ credits() }}
             </span>
             <button (click)="logout()" class="text-gray-600 hover:text-red-600 transition-colors">
                <i class="pi pi-sign-out text-xl"></i>
             </button>
          </div>
          <button *ngIf="!isLoggedIn()" (click)="login()" class="px-4 py-2 bg-blue-600 text-white rounded-md">
             Connexion
          </button>
        </div>
      </header>
      
      <app-wizard></app-wizard>

      <footer class="mt-20 py-8 border-t text-center text-gray-400 text-sm">
        &copy; 2026 Namespoter - Propulsé par BMad Master
      </footer>
    </main>
  `,
  styles: []
})
export class AppComponent implements OnInit {
  title = 'namespoter-web';
  credits = signal(0);
  isLoggedIn = signal(false);

  constructor(
    private userService: UserService,
    private keycloak: KeycloakService
  ) {}

  async ngOnInit() {
    this.isLoggedIn.set(await this.keycloak.isLoggedIn());
    if (this.isLoggedIn()) {
      this.loadCredits();
    }
  }

  loadCredits() {
    this.userService.getCredits().subscribe({
      next: (res) => this.credits.set(res.credits),
      error: () => console.error('Erreur lors du chargement des crédits')
    });
  }

  login() {
    this.keycloak.login();
  }

  logout() {
    this.keycloak.logout(window.location.origin);
  }

  reload() {
    window.location.reload();
  }
}