import { Component, signal, OnInit } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { UserService } from './services/user';
import { ProjectService } from './services/project';
import { KeycloakService } from 'keycloak-angular';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MenuModule } from 'primeng/menu';
import { ButtonModule } from 'primeng/button';
import { MenuItem } from 'primeng/api';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, TranslateModule, MenuModule, ButtonModule],
  template: `
    <main class="min-h-screen bg-gray-50">
      <header class="bg-white shadow-sm border-b sticky top-0 z-50">
        <div class="max-w-7xl mx-auto px-4 h-16 flex justify-between items-center">
          
          <!-- Gauche: Logo et Langue -->
          <div class="flex items-center gap-6">
            <h1 class="text-2xl font-bold text-blue-600 cursor-pointer flex items-center gap-2" (click)="goToHome()">
              <i class="pi pi-compass text-3xl"></i>
              <span class="hidden sm:block">Namespoter</span>
            </h1>
            
            <div class="flex bg-gray-100 p-1 rounded-md">
              <button (click)="setLang('fr')" [class.bg-white]="currentLang() === 'fr'" [class.shadow-sm]="currentLang() === 'fr'" class="px-2 py-1 rounded text-[10px] font-bold transition-all">FR</button>
              <button (click)="setLang('en')" [class.bg-white]="currentLang() === 'en'" [class.shadow-sm]="currentLang() === 'en'" class="px-2 py-1 rounded text-[10px] font-bold transition-all">EN</button>
            </div>
          </div>

          <!-- Centre / Droite: Menu Principal -->
          <div class="flex items-center gap-2 sm:gap-4">
            
            <ng-container *ngIf="isLoggedIn()">
              <!-- Bouton Mes Projets -->
              <p-button 
                [label]="'APP.MY_PROJECTS' | translate" 
                icon="pi pi-folder" 
                [text]="true"
                severity="secondary"
                (click)="openProjects()">
              </p-button>

              <!-- Séparateur vertical -->
              <div class="h-8 w-[1px] bg-gray-200 mx-2 hidden sm:block"></div>

              <!-- Profil et Crédits -->
              <div class="flex items-center gap-3 pl-2">
                <div class="hidden md:flex flex-col items-end">
                  <span class="text-xs font-bold text-gray-900">{{ userName() }}</span>
                  <span class="text-[10px] text-blue-600 font-semibold">{{ 'APP.CREDITS' | translate }}: {{ credits() }}</span>
                </div>
                
                <button #userBtn (click)="userMenu.toggle($event)" class="w-10 h-10 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 hover:bg-blue-100 transition-colors">
                  <i class="pi pi-user text-xl"></i>
                </button>
                <p-menu #userMenu [model]="profileMenuItems" [popup]="true" appendTo="body"></p-menu>
              </div>
            </ng-container>

            <button *ngIf="!isLoggedIn()" (click)="login()" class="px-6 py-2 bg-blue-600 text-white rounded-full font-bold hover:bg-blue-700 transition-all shadow-md">
               {{ 'APP.LOGIN' | translate }}
            </button>
          </div>
        </div>
      </header>
      
      <router-outlet></router-outlet>

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
  userName = signal('');
  
  profileMenuItems: MenuItem[] = [];

  constructor(
    private userService: UserService,
    public projectService: ProjectService,
    private keycloak: KeycloakService,
    private translate: TranslateService,
    private router: Router
  ) {}

  async ngOnInit() {
    this.isLoggedIn.set(await this.keycloak.isLoggedIn());
    this.currentLang.set(this.translate.currentLang || 'fr');
    
    if (this.isLoggedIn()) {
      const profile = await this.keycloak.loadUserProfile();
      this.userName.set(profile.firstName || profile.username || '');
      this.loadCredits();
      this.updateProfileMenu();
    }

    this.translate.onLangChange.subscribe(() => {
      this.updateProfileMenu();
    });

    this.userService.credits$.subscribe(val => this.credits.set(val));
  }

  updateProfileMenu() {
    this.translate.get(['APP.CREDITS', 'APP.LOGOUT']).subscribe(res => {
      this.profileMenuItems = [
        {
          label: `${res['APP.CREDITS']}: ${this.credits()}`,
          icon: 'pi pi-wallet',
          disabled: true
        },
        { separator: true },
        {
          label: res['APP.LOGOUT'],
          icon: 'pi pi-sign-out',
          command: () => this.logout()
        }
      ];
    });
  }

  setLang(lang: string) {
    this.translate.use(lang);
    this.currentLang.set(lang);
  }

  loadCredits() {
    this.userService.getCredits().subscribe();
  }

  openProjects() {
    this.projectService.refreshProjects().subscribe();
    this.projectService.showDrawer.set(true);
  }

  login() {
    this.keycloak.login();
  }

  logout() {
    this.keycloak.logout(window.location.origin);
  }

  goToHome() {
    this.router.navigate(['/']);
  }

  reload() {
    window.location.reload();
  }
}
