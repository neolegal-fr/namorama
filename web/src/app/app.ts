import { Component, signal, OnInit } from '@angular/core';
import { WizardComponent } from './components/wizard/wizard';
import { UserService } from './services/user';
import { KeycloakService } from 'keycloak-angular';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, WizardComponent, TranslateModule],
  template: `
    <main class="min-h-screen bg-gray-50">
      <header class="bg-white shadow-sm py-4">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div class="flex items-center gap-6">
            <h1 class="text-2xl font-bold text-blue-600 cursor-pointer" (click)="reload()">Namespoter</h1>
            
            <div class="flex bg-gray-100 p-1 rounded-md">
              <button 
                (click)="setLang('fr')" 
                [class.bg-white]="currentLang() === 'fr'"
                [class.shadow-sm]="currentLang() === 'fr'"
                class="px-3 py-1 rounded text-xs font-bold transition-all">FR</button>
              <button 
                (click)="setLang('en')" 
                [class.bg-white]="currentLang() === 'en'"
                [class.shadow-sm]="currentLang() === 'en'"
                class="px-3 py-1 rounded text-xs font-bold transition-all">EN</button>
            </div>
          </div>

          <div class="flex items-center gap-4" *ngIf="isLoggedIn()">
             <span class="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
                {{ 'APP.CREDITS' | translate }}: {{ credits() }}
             </span>
             <button (click)="logout()" class="text-gray-600 hover:text-red-600 transition-colors" [title]="'APP.LOGOUT' | translate">
                <i class="pi pi-sign-out text-xl"></i>
             </button>
          </div>
          <button *ngIf="!isLoggedIn()" (click)="login()" class="px-4 py-2 bg-blue-600 text-white rounded-md">
             {{ 'APP.LOGIN' | translate }}
          </button>
        </div>
      </header>
      
      <app-wizard></app-wizard>

      <footer class="mt-20 py-8 border-t text-center text-gray-400 text-sm">
        &copy; 2026 Namespoter - {{ 'APP.FOOTER' | translate }}
      </footer>
    </main>
  `,
  styles: []
})
export class AppComponent implements OnInit {
  title = 'namespoter-web';
  credits = signal(0);
  isLoggedIn = signal(false);
  currentLang = signal('fr');

  constructor(
    private userService: UserService,
    private keycloak: KeycloakService,
    private translate: TranslateService
  ) {}

  async ngOnInit() {
    this.isLoggedIn.set(await this.keycloak.isLoggedIn());
    this.currentLang.set(this.translate.currentLang || 'fr');
    
    // S'abonner aux changements de crédits
    this.userService.credits$.subscribe(val => this.credits.set(val));

    if (this.isLoggedIn()) {
      this.loadCredits();
    }
  }

  setLang(lang: string) {
    this.translate.use(lang);
    this.currentLang.set(lang);
  }

  loadCredits() {
    this.userService.getCredits().subscribe();
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