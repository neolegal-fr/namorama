import { Component, signal, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { RouterOutlet, Router, RouterModule } from '@angular/router';
import { UserService, CreditInfo } from './services/user';
import { ProjectService } from './services/project';
import { PaymentService, PackType } from './services/payment';
import { FeedbackService } from './services/feedback';
import { CookieConsentService } from './services/cookie-consent';
import { KeycloakService } from 'keycloak-angular';
import { CommonModule, DatePipe } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MenuModule } from 'primeng/menu';
import { ButtonModule } from 'primeng/button';
import { MenubarModule } from 'primeng/menubar';
import { AvatarModule } from 'primeng/avatar';
import { MenuItem, MessageService } from 'primeng/api';
import { Toast } from 'primeng/toast';
import { Textarea } from 'primeng/textarea';
import { InputText } from 'primeng/inputtext';

import { FormsModule } from '@angular/forms';

import { Dialog } from 'primeng/dialog';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterModule,
    TranslateModule,
    MenuModule,
    ButtonModule,
    MenubarModule,
    AvatarModule,
    FormsModule,
    Dialog,
    DatePipe,
    Toast,
    Textarea,
    InputText,
  ],
  template: `
    <main class="min-h-screen">
      <p-menubar styleClass="border-0 border-b border-surface bg-surface-0 px-3 md:px-5 sticky top-0" style="height: 4rem; z-index: 100">
        <ng-template pTemplate="start">
          <div class="flex align-items-center gap-2 cursor-pointer" (click)="goToHome()">
            <i class="pi pi-compass text-2xl text-primary"></i>
            <span class="text-xl font-bold text-900">Namorama</span>
          </div>
        </ng-template>

        <ng-template pTemplate="end">
          <div class="flex align-items-center gap-2">

            <!-- Langue Selector -->
            <button (click)="langMenu.toggle($event)" class="lang-toggle cursor-pointer border-circle p-2" style="background: none; border: none; transition: background 0.15s">
              <span [class]="currentFlagClass" style="font-size: 1.25rem"></span>
            </button>
            <p-menu #langMenu [model]="langMenuItems" [popup]="true" appendTo="body"></p-menu>

            <ng-container *ngIf="isLoggedIn()">
              <p-button
                [label]="'APP.PROJECTS' | translate"
                icon="pi pi-folder"
                [text]="true"
                severity="secondary"
                (onClick)="projectMenu.toggle($event)">
              </p-button>
              <p-menu #projectMenu [model]="projectMenuItems" [popup]="true" appendTo="body"></p-menu>

                <p-avatar
                  icon="pi pi-user"
                  shape="circle"
                  class="cursor-pointer ml-2"
                  styleClass="bg-primary text-primary-contrast shadow-1"
                  (click)="userMenu.toggle($event)">
                </p-avatar>
                <p-menu #userMenu [model]="profileMenuItems" [popup]="true" appendTo="body"></p-menu>
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
        <div class="w-full" [style.max-width]="router.url.startsWith('/admin') ? '72rem' : '44rem'">
          <router-outlet></router-outlet>
        </div>
      </div>

      <!-- Dialogue de facturation (packs sans abonnement) -->
      <p-dialog [header]="'BILLING.TITLE' | translate"
                [visible]="projectService.showCreditDialog()"
                (visibleChange)="onBillingDialogVisibilityChange($event)"
                [modal]="true"
                [style]="{ width: 'min(30rem, 92vw)' }"
                [draggable]="false"
                [resizable]="false">

        <!-- Tagline anti-abonnement -->
        <div style="text-align: center; margin-bottom: 1.25rem; padding-bottom: 1.25rem; border-bottom: 1px solid var(--p-surface-200)">
          <div style="font-size: 1rem; font-weight: 700; color: var(--p-primary-color); margin-bottom: 0.4rem">
            {{ 'BILLING.TAGLINE' | translate }}
          </div>
          <div style="font-size: 0.85rem; color: var(--p-surface-500)">
            {{ 'BILLING.TAGLINE_SUB' | translate }}
          </div>
        </div>

        <!-- Crédits gratuits mensuels -->
        <div style="margin-bottom: 1.25rem; padding-bottom: 1.25rem; border-bottom: 1px solid var(--p-surface-200)">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem">
            <span class="font-semibold text-900" style="font-size: 0.9rem">{{ creditInfo().freeCredits + creditInfo().packCredits }} {{ 'BILLING.FREE_TITLE' | translate }}</span>
            <span style="font-size: 0.8rem; color: var(--p-surface-500)">
              {{ 'BILLING.FREE_RESET' | translate : { date: (creditInfo().freeResetDate | date:'d MMM') } }}
            </span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem">
            <span style="font-size: 0.85rem; color: var(--p-surface-600)">{{ creditInfo().freeCredits }} / 100 {{ 'BILLING.FREE_MONTHLY' | translate }}</span>
          </div>
          <div style="height: 6px; border-radius: 3px; background: var(--p-surface-200); overflow: hidden">
            <div style="height: 100%; background: var(--p-primary-color); border-radius: 3px; transition: width 0.3s"
              [style.width.%]="creditInfo().freeCredits / 100 * 100">
            </div>
          </div>
          <div *ngIf="creditInfo().packCredits > 0" style="margin-top: 0.5rem; font-size: 0.8rem; color: var(--p-surface-500)">
            {{ 'BILLING.PACK_BALANCE' | translate : { n: creditInfo().packCredits } }}
          </div>
        </div>

        <!-- 3 packs -->
        <div>
          <div style="font-size: 0.9rem; font-weight: 600; color: var(--p-surface-700); margin-bottom: 0.75rem">
            {{ 'BILLING.PACK_TITLE' | translate }}
          </div>
          <div style="display: flex; flex-direction: column; gap: 0.5rem">

            <!-- Pack Découverte -->
            <div style="display: flex; align-items: center; justify-content: space-between; background: var(--p-surface-50); border-radius: 0.5rem; padding: 0.75rem 1rem; border: 1px solid var(--p-surface-200)">
              <div>
                <div class="font-semibold text-900" style="font-size: 0.9rem">{{ 'BILLING.PACK_DECOUVERTE_NAME' | translate }}</div>
                <div style="font-size: 0.8rem; color: var(--p-surface-500)">500 {{ 'BILLING.CREDITS' | translate }} · 0,018 € / crédit</div>
              </div>
              <div style="display: flex; align-items: center; gap: 0.75rem">
                <span style="font-size: 1rem; font-weight: 700; color: var(--p-surface-800)">9 €</span>
                <p-button
                  [label]="'BILLING.BUY_BTN' | translate"
                  size="small"
                  [loading]="billingLoading() === 'decouverte'"
                  [disabled]="billingLoading() !== false"
                  (onClick)="buyPack('decouverte')">
                </p-button>
              </div>
            </div>

            <!-- Pack Pro (populaire) -->
            <div style="display: flex; align-items: center; justify-content: space-between; background: var(--p-primary-50, #eff6ff); border-radius: 0.5rem; padding: 0.75rem 1rem; border: 2px solid var(--p-primary-color)">
              <div>
                <div style="display: flex; align-items: center; gap: 0.5rem">
                  <span class="font-semibold text-900" style="font-size: 0.9rem">{{ 'BILLING.PACK_PRO_NAME' | translate }}</span>
                  <span style="font-size: 0.7rem; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 999px; background: var(--p-primary-color); color: white">
                    {{ 'BILLING.PACK_POPULAR' | translate }}
                  </span>
                </div>
                <div style="font-size: 0.8rem; color: var(--p-surface-500)">2 000 {{ 'BILLING.CREDITS' | translate }} · 0,0095 € / crédit</div>
              </div>
              <div style="display: flex; align-items: center; gap: 0.75rem">
                <span style="font-size: 1rem; font-weight: 700; color: var(--p-surface-800)">19 €</span>
                <p-button
                  [label]="'BILLING.BUY_BTN' | translate"
                  size="small"
                  [loading]="billingLoading() === 'pro'"
                  [disabled]="billingLoading() !== false"
                  (onClick)="buyPack('pro')">
                </p-button>
              </div>
            </div>

            <!-- Pack Max -->
            <div style="display: flex; align-items: center; justify-content: space-between; background: var(--p-surface-50); border-radius: 0.5rem; padding: 0.75rem 1rem; border: 1px solid var(--p-surface-200)">
              <div>
                <div class="font-semibold text-900" style="font-size: 0.9rem">{{ 'BILLING.PACK_MAX_NAME' | translate }}</div>
                <div style="font-size: 0.8rem; color: var(--p-surface-500)">5 000 {{ 'BILLING.CREDITS' | translate }} · 0,0058 € / crédit</div>
              </div>
              <div style="display: flex; align-items: center; gap: 0.75rem">
                <span style="font-size: 1rem; font-weight: 700; color: var(--p-surface-800)">29 €</span>
                <p-button
                  [label]="'BILLING.BUY_BTN' | translate"
                  size="small"
                  [loading]="billingLoading() === 'max'"
                  [disabled]="billingLoading() !== false"
                  (onClick)="buyPack('max')">
                </p-button>
              </div>
            </div>

          </div>
        </div>
      </p-dialog>

      <!-- Dialog Feedback / Signalement -->
      <p-dialog [header]="(isLoggedIn() ? 'FEEDBACK.DIALOG_TITLE_CREDITS' : 'FEEDBACK.DIALOG_TITLE_REPORT') | translate"
                [visible]="showFeedbackDialog()"
                (visibleChange)="showFeedbackDialog.set($event)"
                [modal]="true"
                [style]="{ width: 'min(34rem, 92vw)' }"
                [draggable]="false"
                [resizable]="false">
        <div style="display: flex; flex-direction: column; gap: 1rem">
          <p style="margin: 0; font-size: 0.9rem; color: var(--p-surface-600)">
            {{ (isLoggedIn() ? 'FEEDBACK.DIALOG_HEADLINE_CREDITS' : 'FEEDBACK.DIALOG_HEADLINE_REPORT') | translate }}
          </p>
          <div>
            <label style="display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 0.375rem; color: var(--p-surface-600)">
              {{ 'FEEDBACK.MESSAGE_LABEL' | translate }} *
            </label>
            <textarea pInputTextarea
                      [(ngModel)]="feedbackMessage"
                      rows="5"
                      style="width: 100%; resize: vertical"
                      [placeholder]="(isLoggedIn() ? 'FEEDBACK.MESSAGE_PLACEHOLDER_CREDITS' : 'FEEDBACK.MESSAGE_PLACEHOLDER_REPORT') | translate">
            </textarea>
            <div style="display: flex; justify-content: space-between; margin-top: 0.25rem; font-size: 0.75rem; color: var(--p-surface-400)">
              <span *ngIf="feedbackMessage.length < 10" style="color: var(--p-orange-500)">Minimum 10 caractères</span>
              <span *ngIf="feedbackMessage.length >= 10"></span>
              <span>{{ feedbackMessage.length }} / 1000</span>
            </div>
          </div>
          <div>
            <label style="display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 0.375rem; color: var(--p-surface-600)">
              {{ 'FEEDBACK.EMAIL_LABEL' | translate }}
            </label>
            <input pInputText [(ngModel)]="feedbackEmail" type="email" style="width: 100%" placeholder="ex: moi@email.com">
          </div>
          <p style="margin: 0; font-size: 0.8rem; color: var(--p-surface-400)">
            {{ 'FEEDBACK.CONTACT_ALT' | translate }}
            <a href="mailto:contact@namorama.com" style="color: var(--p-primary-color); text-decoration: none; font-weight: 600">contact@namorama.com</a>
          </p>
          <div style="display: flex; justify-content: flex-end">
            <p-button
              [label]="(isLoggedIn() ? 'FEEDBACK.SUBMIT_BTN_CREDITS' : 'FEEDBACK.SUBMIT_BTN_REPORT') | translate"
              icon="pi pi-send"
              [loading]="feedbackLoading()"
              [disabled]="feedbackMessage.length < 10"
              (onClick)="submitFeedback()">
            </p-button>
          </div>
        </div>
      </p-dialog>

      <footer class="mt-8 py-6 border-top-1 border-solid text-center text-400 text-sm" style="background: white">
        <div class="mb-2 font-bold text-500">Namorama &copy; 2026</div>
        {{ 'APP.FOOTER' | translate }}
        <a href="https://neolegal.fr" target="_blank" rel="noopener" style="color: inherit; font-weight: 600; text-decoration: none; border-bottom: 1px solid currentColor">NeoLegal</a>
        <span style="margin: 0 0.5rem">·</span>
        <button type="button" (click)="openFeedback()"
                style="background: none; border: none; cursor: pointer; color: inherit; font-size: inherit; text-decoration: underline; text-decoration-style: dotted; padding: 0">
          {{ 'APP.FEEDBACK' | translate }}
        </button>
        <span style="margin: 0 0.5rem">·</span>
        <a routerLink="/legal" style="color: inherit; text-decoration: underline; text-decoration-style: dotted">{{ 'APP.LEGAL' | translate }}</a>
        <span style="margin: 0 0.5rem">·</span>
        <a routerLink="/privacy" style="color: inherit; text-decoration: underline; text-decoration-style: dotted">{{ 'APP.PRIVACY' | translate }}</a>
      </footer>
      <p-toast key="app" position="top-right"></p-toast>
    </main>
  `,
  styles: []
})
export class AppComponent implements OnInit {
  title = 'namorama-web';
  credits = signal(0);
  creditInfo = signal<CreditInfo>({ freeCredits: 0, packCredits: 0, freeResetDate: '' });
  billingLoading = signal<PackType | false>(false);
  isLoggedIn = signal(false);
  isAdmin = signal(false);
  currentLang = signal('fr');
  selectedLang = 'fr';
  userName = signal('');
  userEmail = signal('');
  
  readonly languages = [
    { label: 'Čeština',    code: 'cs', flag: 'fi fi-cz' },
    { label: 'Dansk',      code: 'da', flag: 'fi fi-dk' },
    { label: 'Deutsch',    code: 'de', flag: 'fi fi-de' },
    { label: 'English',    code: 'en', flag: 'fi fi-gb' },
    { label: 'Español',    code: 'es', flag: 'fi fi-es' },
    { label: 'Suomi',      code: 'fi', flag: 'fi fi-fi' },
    { label: 'Français',   code: 'fr', flag: 'fi fi-fr' },
    { label: 'Magyar',     code: 'hu', flag: 'fi fi-hu' },
    { label: 'Italiano',   code: 'it', flag: 'fi fi-it' },
    { label: 'Nederlands', code: 'nl', flag: 'fi fi-nl' },
    { label: 'Norsk',      code: 'no', flag: 'fi fi-no' },
    { label: 'Polski',     code: 'pl', flag: 'fi fi-pl' },
    { label: 'Português',  code: 'pt', flag: 'fi fi-pt' },
    { label: 'Română',     code: 'ro', flag: 'fi fi-ro' },
    { label: 'Svenska',    code: 'sv', flag: 'fi fi-se' },
    { label: 'Türkçe',     code: 'tr', flag: 'fi fi-tr' },
    { label: 'Русский',    code: 'ru', flag: 'fi fi-ru' },
    { label: '日本語',      code: 'ja', flag: 'fi fi-jp' },
    { label: '中文',        code: 'zh', flag: 'fi fi-cn' },
  ];

  readonly langMenuItems: MenuItem[] = this.languages.map(l => ({
    label: l.label,
    icon: l.flag,
    command: () => this.setLang(l.code)
  }));

  get currentFlagClass(): string {
    return this.languages.find(l => l.code === this.selectedLang)?.flag ?? 'fi fi-fr';
  }

  profileMenuItems: MenuItem[] = [];
  projectMenuItems: MenuItem[] = [];

  // Feedback
  showFeedbackDialog = signal(false);
  feedbackMessage = '';
  feedbackEmail = '';
  feedbackLoading = signal(false);

  constructor(
    private userService: UserService,
    public projectService: ProjectService,
    private keycloak: KeycloakService,
    private translate: TranslateService,
    public router: Router,
    private cdr: ChangeDetectorRef,
    private paymentService: PaymentService,
    private cookieConsent: CookieConsentService,
    private feedbackService: FeedbackService,
    private messageService: MessageService,
  ) {}

  async ngOnInit() {
    this.cookieConsent.init();
    this.isLoggedIn.set(await this.keycloak.isLoggedIn());
    this.isAdmin.set(this.keycloak.isUserInRole('admin'));
    const lang = this.translate.currentLang || 'fr';
    this.currentLang.set(lang);
    this.selectedLang = lang;
    document.documentElement.lang = lang;
    
    if (this.isLoggedIn()) {
      const profile = await this.keycloak.loadUserProfile();
      this.userName.set(profile.firstName || profile.username || '');
      this.userEmail.set(profile.email || '');
      this.loadCredits();

      // Locale depuis le token Keycloak (prioritaire sur le navigateur)
      const token = this.keycloak.getKeycloakInstance().tokenParsed as any;
      const keycloakLocale = token?.locale ?? token?.preferred_locale ?? (profile as any).attributes?.locale?.[0];
      if (keycloakLocale) {
        const lang = String(keycloakLocale).toLowerCase().slice(0, 2);
        if (this.languages.some(l => l.code === lang)) this.setLang(lang);
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

    this.userService.creditInfo$.subscribe(info => {
      this.creditInfo.set(info);
    });

    this.feedbackService.openDialog$.subscribe(() => this.openFeedback());
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
    this.translate.get(['APP.CREDITS', 'APP.LOGOUT', 'APP.MANAGE_ACCOUNT', 'APP.ADMIN']).subscribe(res => {
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
            ...(this.isAdmin() ? [{
              label: res['APP.ADMIN'],
              icon: 'pi pi-shield',
              command: () => this.router.navigate(['/admin'])
            }] : []),
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
    this.userService.getSubscription().subscribe();
    this.projectService.showCreditDialog.set(true);
    this.cdr.detectChanges();
  }

  onBillingDialogVisibilityChange(visible: boolean) {
    this.projectService.showCreditDialog.set(visible);
  }

  buyPack(packType: PackType) {
    this.billingLoading.set(packType);
    this.paymentService.createPackCheckout(packType).subscribe({
      next: ({ url }) => { window.location.href = url; },
      error: () => this.billingLoading.set(false),
    });
  }

  setLang(lang: string) {
    this.translate.use(lang);
    this.currentLang.set(lang);
    this.selectedLang = lang;
    document.documentElement.lang = lang;
  }

  loadCredits() {
    this.userService.getCredits().subscribe();
  }

  openProjects() {
    const show = () => {
      this.projectService.refreshProjects().subscribe();
      this.projectService.showDrawer.set(true);
    };
    if (this.router.url.startsWith('/admin')) {
      this.router.navigate(['/']).then(() => setTimeout(show, 100));
    } else {
      show();
    }
  }

  newProject() {
    if (this.router.url.startsWith('/admin')) {
      this.router.navigate(['/']).then(() => setTimeout(() => this.projectService.resetWizard(), 100));
    } else {
      this.projectService.resetWizard();
    }
  }

  login() {
    // zh uses BCP47 zh-Hans to match Keycloak's base theme message file
    const kcLocale = this.selectedLang === 'zh' ? 'zh-Hans' : this.selectedLang;
    this.keycloak.login({ locale: kcLocale });
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

  openFeedback() {
    this.feedbackMessage = '';
    this.feedbackEmail = this.userEmail();
    this.showFeedbackDialog.set(true);
  }

  submitFeedback() {
    if (this.feedbackMessage.length < 10) return;
    this.feedbackLoading.set(true);
    this.feedbackService.submit(this.feedbackMessage, this.feedbackEmail || undefined).subscribe({
      next: (res) => {
        this.feedbackLoading.set(false);
        this.showFeedbackDialog.set(false);
        const detailKey = res.creditsAwarded ? 'FEEDBACK.SUCCESS_DETAIL_CREDITS' : 'FEEDBACK.SUCCESS_DETAIL_REPORT';
        this.translate.get(['FEEDBACK.SUCCESS_SUMMARY', detailKey]).subscribe(t => {
          this.messageService.add({ key: 'app', severity: 'success', summary: t['FEEDBACK.SUCCESS_SUMMARY'], detail: t[detailKey], life: 6000 });
        });
        if (res.creditsAwarded) this.userService.getCredits().subscribe();
      },
      error: (err) => {
        this.feedbackLoading.set(false);
        const key = err?.error?.message === 'RATE_LIMIT' ? 'FEEDBACK.RATE_LIMIT' : 'FEEDBACK.ERROR_DETAIL';
        this.translate.get(key).subscribe(msg => {
          this.messageService.add({ key: 'app', severity: err?.error?.message === 'RATE_LIMIT' ? 'warn' : 'error', summary: '', detail: msg, life: 6000 });
        });
      }
    });
  }
}