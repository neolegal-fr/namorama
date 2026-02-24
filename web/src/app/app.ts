import { Component, signal, OnInit, ChangeDetectorRef } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { UserService } from './services/user';
import { ProjectService } from './services/project';
import { PaymentService } from './services/payment';
import { KeycloakService } from 'keycloak-angular';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MenuModule } from 'primeng/menu';
import { ButtonModule } from 'primeng/button';
import { MenubarModule } from 'primeng/menubar';
import { AvatarModule } from 'primeng/avatar';
import { MenuItem } from 'primeng/api';

import { FormsModule } from '@angular/forms';

import { Dialog } from 'primeng/dialog';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule, 
    RouterOutlet, 
    TranslateModule, 
    MenuModule, 
    ButtonModule, 
    MenubarModule, 
    AvatarModule,
    FormsModule,
    Dialog,
  ],
  template: `
    <main class="min-h-screen">
      <p-menubar styleClass="border-0 border-b border-surface bg-surface-0 px-3 md:px-5 sticky top-0" style="height: 4rem; z-index: 100">
        <ng-template pTemplate="start">
          <div class="flex align-items-center gap-2 cursor-pointer" (click)="goToHome()">
            <i class="pi pi-compass text-2xl text-primary"></i>
            <span class="text-xl font-bold text-900">NameSpotter</span>
          </div>
        </ng-template>

        <ng-template pTemplate="end">
          <div class="flex align-items-center gap-2">

            <!-- Langue Toggle -->
            <button (click)="toggleLang()" class="lang-toggle cursor-pointer border-circle p-2" style="background: none; border: none; transition: background 0.15s">
              <span [class]="'fi fi-' + (selectedLang === 'fr' ? 'fr' : 'gb')" style="font-size: 1.25rem"></span>
            </button>

            <ng-container *ngIf="isLoggedIn()">
              <p-button
                [label]="'APP.PROJECTS' | translate"
                icon="pi pi-folder"
                [text]="true"
                severity="secondary"
                (onClick)="projectMenu.toggle($event)">
              </p-button>
              <p-menu #projectMenu [model]="projectMenuItems" [popup]="true"></p-menu>

                <p-avatar
                  icon="pi pi-user"
                  shape="circle"
                  class="cursor-pointer ml-2"
                  styleClass="bg-primary text-primary-contrast shadow-1"
                  (click)="userMenu.toggle($event)">
                </p-avatar>
                <p-menu #userMenu [model]="profileMenuItems" [popup]="true"></p-menu>
            </ng-container>

            <p-button
              *ngIf="!isLoggedIn()"
              [label]="'APP.LOGIN' | translate"
              icon="pi pi-sign-in"
              [rounded]="true"
              (onClick)="login()">
            </p-button>
          </div>
        </ng-template>
      </p-menubar>

      <div class="flex flex-column align-items-center w-full px-3 py-3 md:py-5">
        <div class="w-full" style="max-width: 44rem">
          <router-outlet></router-outlet>
        </div>
      </div>

      <!-- Dialogue de facturation (abonnement + packs) -->
      <p-dialog [header]="'BILLING.TITLE' | translate"
                [visible]="projectService.showCreditDialog()"
                (visibleChange)="projectService.showCreditDialog.set($event)"
                [modal]="true"
                [style]="{ width: 'min(28rem, 90vw)' }"
                [draggable]="false"
                [resizable]="false">

        <!-- Section abonnement -->
        <div style="margin-bottom: 1.25rem; padding-bottom: 1.25rem; border-bottom: 1px solid var(--p-surface-200)">
          <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem">
            <i class="pi pi-star-fill" style="color: var(--p-primary-color)"></i>
            <span class="font-bold text-900">{{ 'BILLING.SUBSCRIPTION_TITLE' | translate }}</span>
          </div>
          <div style="background: var(--p-surface-50); border-radius: 0.5rem; padding: 0.875rem 1rem; margin-bottom: 0.75rem">
            <div class="font-semibold text-900">{{ 'BILLING.ESSENTIAL_NAME' | translate }}</div>
            <div class="text-500" style="font-size: 0.85rem; margin-top: 0.2rem">{{ 'BILLING.ESSENTIAL_DESC' | translate }}</div>
            <div style="margin-top: 0.5rem; font-size: 1.1rem; font-weight: 700; color: var(--p-primary-color)">5 € / mois</div>
          </div>
          <div style="display: flex; gap: 0.5rem">
            <p-button *ngIf="!hasActiveSubscription()"
              [label]="'BILLING.SUBSCRIBE_BTN' | translate"
              icon="pi pi-arrow-right"
              [loading]="billingLoading()"
              (onClick)="subscribeEssential()"
              styleClass="flex-1">
            </p-button>
            <p-button *ngIf="hasActiveSubscription()"
              [label]="'BILLING.MANAGE_BTN' | translate"
              icon="pi pi-cog"
              severity="secondary"
              [loading]="billingLoading()"
              (onClick)="openPortal()"
              styleClass="flex-1">
            </p-button>
          </div>
          <div *ngIf="hasActiveSubscription()" style="margin-top: 0.5rem; font-size: 0.8rem; color: #16a34a; display: flex; align-items: center; gap: 0.375rem">
            <i class="pi pi-check-circle"></i>
            <span>{{ 'BILLING.ACTIVE_SUBSCRIPTION' | translate }} — {{ subscriptionCredits() }} {{ 'BILLING.CREDITS_REMAINING' | translate }}</span>
          </div>
        </div>

        <!-- Section pack extra -->
        <div>
          <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem">
            <i class="pi pi-wallet" style="color: var(--p-primary-color)"></i>
            <span class="font-bold text-900">{{ 'BILLING.PACK_TITLE' | translate }}</span>
          </div>
          <div style="background: var(--p-surface-50); border-radius: 0.5rem; padding: 0.875rem 1rem; margin-bottom: 0.75rem; display: flex; align-items: center; justify-content: space-between">
            <div>
              <div class="font-semibold text-900">{{ 'BILLING.PACK_NAME' | translate }}</div>
              <div class="text-500" style="font-size: 0.85rem; margin-top: 0.2rem">{{ 'BILLING.PACK_DESC' | translate }}</div>
              <div style="margin-top: 0.5rem; font-size: 1.1rem; font-weight: 700; color: var(--p-primary-color)">10 €</div>
            </div>
            <p-button
              [label]="'BILLING.BUY_BTN' | translate"
              icon="pi pi-shopping-cart"
              [loading]="billingLoading()"
              (onClick)="buyPack()">
            </p-button>
          </div>
          <div *ngIf="extraCredits() > 0" style="font-size: 0.8rem; color: var(--p-surface-500)">
            {{ 'BILLING.EXTRA_BALANCE' | translate }} : {{ extraCredits() }} {{ 'BILLING.CREDITS' | translate }}
          </div>
        </div>
      </p-dialog>

      <footer class="mt-8 py-6 border-top-1 border-solid text-center text-400 text-sm" style="background: white">
        <div class="mb-2 font-bold text-500">NameSpotter &copy; 2026</div>
        {{ 'APP.FOOTER' | translate }}
      </footer>
    </main>
  `,
  styles: []
})
export class AppComponent implements OnInit {
  title = 'namespoter-web';
  credits = signal(0);
  subscriptionCredits = signal(0);
  extraCredits = signal(0);
  hasActiveSubscription = signal(false);
  billingLoading = signal(false);
  isLoggedIn = signal(false);
  currentLang = signal('fr');
  selectedLang = 'fr';
  userName = signal('');
  
  languages = [
    { label: 'FR', code: 'fr', flag: 'fr' },
    { label: 'EN', code: 'en', flag: 'gb' }
  ];

  profileMenuItems: MenuItem[] = [];
  projectMenuItems: MenuItem[] = [];

  constructor(
    private userService: UserService,
    public projectService: ProjectService,
    private keycloak: KeycloakService,
    private translate: TranslateService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private paymentService: PaymentService,
  ) {}

  async ngOnInit() {
    this.isLoggedIn.set(await this.keycloak.isLoggedIn());
    const lang = this.translate.currentLang || 'fr';
    this.currentLang.set(lang);
    this.selectedLang = lang;
    
    if (this.isLoggedIn()) {
      const profile = await this.keycloak.loadUserProfile();
      this.userName.set(profile.firstName || profile.username || '');
      this.loadCredits();

      // Locale depuis le token Keycloak (prioritaire sur le navigateur)
      const token = this.keycloak.getKeycloakInstance().tokenParsed as any;
      const keycloakLocale = token?.locale ?? token?.preferred_locale ?? (profile as any).attributes?.locale?.[0];
      if (keycloakLocale) {
        const lang = String(keycloakLocale).toLowerCase().slice(0, 2);
        if (['fr', 'en'].includes(lang)) this.setLang(lang);
      }

      setTimeout(() => { this.updateProfileMenu(); this.updateProjectMenu(); });
    }

    this.translate.onLangChange.subscribe(() => {
      setTimeout(() => { this.updateProfileMenu(); this.updateProjectMenu(); });
    });

    this.userService.credits$.subscribe(val => {
      this.credits.set(val);
      setTimeout(() => this.updateProfileMenu());
    });

    this.userService.billing$.subscribe(info => {
      this.subscriptionCredits.set(info.subscriptionCredits);
      this.extraCredits.set(info.extraCredits);
      this.hasActiveSubscription.set(info.hasActiveSubscription);
    });
  }

  updateProjectMenu() {
    this.translate.get(['APP.PROJECT_NEW', 'APP.PROJECT_OPEN']).subscribe(res => {
      this.projectMenuItems = [
        { label: res['APP.PROJECT_NEW'], icon: 'pi pi-plus', command: () => this.newProject() },
        { label: res['APP.PROJECT_OPEN'], icon: 'pi pi-folder-open', command: () => this.openProjects() }
      ];
      this.cdr.detectChanges();
    });
  }

  updateProfileMenu() {
    this.translate.get(['APP.CREDITS', 'APP.LOGOUT', 'APP.MANAGE_ACCOUNT']).subscribe(res => {
      this.profileMenuItems = [
        {
          label: this.userName(),
          items: [
            {
              label: `${res['APP.CREDITS']}: ${this.credits()}`,
              icon: 'pi pi-wallet',
              command: () => this.triggerCreditDialog()
            },
            {
              label: res['APP.MANAGE_ACCOUNT'],
              icon: 'pi pi-cog',
              command: () => this.keycloak.getKeycloakInstance().accountManagement()
            },
            { separator: true },
            {
              label: res['APP.LOGOUT'],
              icon: 'pi pi-sign-out',
              command: () => this.logout()
            }
          ]
        }
      ];
      this.cdr.detectChanges();
    });
  }

  triggerCreditDialog() {
    this.userService.getCredits().subscribe();
    this.projectService.showCreditDialog.set(true);
    this.cdr.detectChanges();
  }

  subscribeEssential() {
    this.billingLoading.set(true);
    this.paymentService.createSubscriptionCheckout().subscribe({
      next: ({ url }) => { window.location.href = url; },
      error: () => this.billingLoading.set(false),
    });
  }

  buyPack() {
    this.billingLoading.set(true);
    this.paymentService.createPackCheckout().subscribe({
      next: ({ url }) => { window.location.href = url; },
      error: () => this.billingLoading.set(false),
    });
  }

  openPortal() {
    this.billingLoading.set(true);
    this.paymentService.openPortal().subscribe({
      next: ({ url }) => { window.location.href = url; },
      error: () => this.billingLoading.set(false),
    });
  }

  setLang(lang: string) {
    this.translate.use(lang);
    this.currentLang.set(lang);
    this.selectedLang = lang;
  }

  toggleLang() {
    this.setLang(this.selectedLang === 'fr' ? 'en' : 'fr');
  }

  loadCredits() {
    this.userService.getCredits().subscribe();
  }

  openProjects() {
    this.projectService.refreshProjects().subscribe();
    this.projectService.showDrawer.set(true);
  }

  newProject() {
    this.projectService.resetWizard();
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