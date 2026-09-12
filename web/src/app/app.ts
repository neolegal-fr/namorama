import { Component, signal, OnInit, ChangeDetectorRef, inject, Inject, PLATFORM_ID } from '@angular/core';
import { RouterOutlet, Router, RouterModule, NavigationEnd } from '@angular/router';
import { UserService, CreditInfo } from './services/user';
import { ProjectService } from './services/project';
import { PaymentService, PackType } from './services/payment';
import { FeedbackService } from './services/feedback';
import { CookieConsentService } from './services/cookie-consent';
import { AnalyticsService } from './services/analytics';
import { ThemeService } from './services/theme';
import { KeycloakService } from 'keycloak-angular';
import { CommonModule, DatePipe, isPlatformBrowser } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
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
import { Drawer } from 'primeng/drawer';

/** Icône propre à chaque mode, remplacée par une coche sur le mode actif. */
const THEME_ICONS: Record<'system' | 'light' | 'dark', string> = {
  system: 'pi pi-desktop',
  light: 'pi pi-sun',
  dark: 'pi pi-moon',
};

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterModule,
    TranslatePipe,
    MenuModule,
    ButtonModule,
    MenubarModule,
    AvatarModule,
    FormsModule,
    Dialog,
    Drawer,
    DatePipe,
    Toast,
    Textarea,
    InputText,
  ],
  template: `
    <main style="min-height: 100vh; display: flex; flex-direction: column">
      <p-menubar [styleClass]="'border-0 px-3 md:px-5 sticky top-0 ' + (isLanding() ? 'nm-menubar-dark' : 'border-b border-surface bg-surface-0')" style="height: 4rem; z-index: 100">
        <ng-template pTemplate="start">
          <!-- La marque, pas l'icône PrimeIcons « pi-compass » qui lui ressemblait :
               c'est le même SVG que le favicon et que le thème Keycloak — une
               seule marque partout. Deux variantes selon le fond du menubar. -->
          <div class="flex align-items-center gap-2 cursor-pointer" (click)="goToHome()">
            <img [src]="isLanding() ? '/assets/brand/icon-dark.svg' : '/assets/brand/icon.svg'"
                 alt="" width="24" height="24" aria-hidden="true" style="display:block">
            <span class="brand-wordmark text-xl font-bold text-900">Namorama</span>
          </div>
        </ng-template>

        <ng-template pTemplate="end">
          <div class="flex align-items-center gap-2">

            <!-- Langue Selector -->
            <!--
              Le NOM de la langue, dans sa langue — pas un drapeau. Un drapeau
              désigne un pays, pas une langue : celui de l'Espagne ne dit rien
              à un hispanophone d'Amérique latine, et l'anglais n'a pas de
              pays. C'est aussi ce qui permet de supprimer « flag-icons », chargé
              depuis un CDN tiers dans le <head> — coût de chargement sur la
              page indexée, et requête vers un tiers avant consentement.
            -->
            <button (click)="langMenu.toggle($event)" class="lang-toggle"
                    [attr.aria-label]="'APP.LANGUAGE' | translate">
              <i class="pi pi-globe" aria-hidden="true"></i>
              <span class="lang-toggle__code">{{ currentLangLabel }}</span>
            </button>
            <p-menu #langMenu [model]="langMenuItems" [popup]="true" appendTo="body" styleClass="lang-menu"></p-menu>

            <ng-container *ngIf="isLoggedIn()">
              <!-- Compteur de crédits : visible en permanence, c'est le signal
                   de valeur consommée et le point d'entrée vers les packs. -->
              <button type="button"
                      class="credits-pill"
                      [attr.aria-label]="('APP.CREDITS' | translate) + ': ' + credits()"
                      (click)="triggerCreditDialog()">
                <i class="pi pi-wallet" aria-hidden="true"></i><span>{{ credits() }}</span>
              </button>

              <p-button
                [label]="'APP.PROJECTS' | translate"
                [ariaLabel]="'APP.PROJECTS' | translate"
                icon="pi pi-folder"
                [text]="true"
                severity="secondary"
                styleClass="nav-btn nav-btn--desktop"
                (onClick)="projectMenu.toggle($event)">
              </p-button>
              <p-menu #projectMenu [model]="projectMenuItems" [popup]="true" appendTo="body"></p-menu>

              <ng-container *ngIf="isAdmin()">
                <p-button
                  [label]="'APP.ADMIN' | translate"
                  [ariaLabel]="'APP.ADMIN' | translate"
                  icon="pi pi-shield"
                  [text]="true"
                  severity="secondary"
                  styleClass="nav-btn nav-btn--desktop"
                  (onClick)="adminMenu.toggle($event)">
                </p-button>
                <p-menu #adminMenu [model]="adminMenuItems" [popup]="true" appendTo="body"></p-menu>
              </ng-container>

                <p-avatar
                  icon="pi pi-user"
                  shape="circle"
                  class="cursor-pointer nav-avatar"
                  styleClass="bg-primary text-primary-contrast shadow-1"
                  role="button"
                  tabindex="0"
                  [ariaLabel]="'APP.MANAGE_ACCOUNT' | translate"
                  (click)="openAccountMenu($event, userMenu)"
                  (keydown.enter)="openAccountMenu($event, userMenu)"
                  (keydown.space)="openAccountMenu($event, userMenu)">
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

      <!--
        Panneau de compte mobile, ancré en bas dans la zone du pouce. Il remplace
        les menus déroulants du header sous 640 px : on n'essaie plus de faire
        tenir une navigation desktop dans 360 px. Le choix entre panneau et menu
        se fait au clic (matchMedia), pas au rendu, pour ne pas casser
        l'hydratation des pages prérendues.
      -->
      <p-drawer [visible]="showAccountSheet()"
                (visibleChange)="showAccountSheet.set($event)"
                position="bottom"
                [showCloseIcon]="false"
                styleClass="account-sheet"
                [style]="{ height: 'auto', maxHeight: '85vh' }">
        <div class="account-sheet__grab"></div>

        <div class="account-sheet__identity">
          <div class="account-sheet__name">{{ userName() }}</div>
          <div class="account-sheet__email">{{ userEmail() }}</div>
        </div>

        <button type="button" class="account-sheet__credits" (click)="sheetCredits()">
          <span><i class="pi pi-bolt"></i> {{ credits() }} {{ 'BILLING.CREDITS' | translate }}</span>
          <span class="account-sheet__topup">{{ 'APP.TOP_UP' | translate }}</span>
        </button>

        <nav class="account-sheet__rows">
          <button type="button" class="account-sheet__row" (click)="sheetNewProject()">
            <i class="pi pi-plus"></i><span>{{ 'APP.PROJECT_NEW' | translate }}</span>
          </button>
          <button type="button" class="account-sheet__row" (click)="sheetProjects()">
            <i class="pi pi-folder-open"></i><span>{{ 'APP.PROJECT_OPEN' | translate }}</span>
          </button>
          <button type="button" class="account-sheet__row" (click)="sheetAccount()">
            <i class="pi pi-cog"></i><span>{{ 'APP.MANAGE_ACCOUNT' | translate }}</span>
          </button>

          <ng-container *ngIf="isAdmin()">
            <div class="account-sheet__section">{{ 'APP.ADMIN' | translate }}</div>
            <button type="button" class="account-sheet__row" *ngFor="let item of adminMenuItems"
                    (click)="sheetAdmin(item)">
              <i [class]="item.icon"></i><span>{{ item.label }}</span>
            </button>
          </ng-container>

          <div class="account-sheet__section">{{ 'APP.THEME' | translate }}</div>
          @for (t of themeChoices; track t.key) {
            <button type="button" class="account-sheet__row"
                    [class.account-sheet__row--on]="theme.choice() === t.key"
                    (click)="theme.set(t.key)">
              <i [class]="theme.choice() === t.key ? 'pi pi-check' : themeIcon(t.key)"></i>
              <span>{{ t.label | translate }}</span>
            </button>
          }

          <div class="account-sheet__section"></div>
          <button type="button" class="account-sheet__row" (click)="sheetLogout()">
            <i class="pi pi-sign-out"></i><span>{{ 'APP.LOGOUT' | translate }}</span>
          </button>
        </nav>
      </p-drawer>

      <!-- L'accueil sort du gabarit commun : son héros est un aplat sombre
           pleine largeur, et ses sections claires vont de bord à bord. Il porte
           donc lui-même sa largeur maximale (1200px) et ses marges internes.
           Les autres routes gardent le conteneur centré. -->
      <div class="flex flex-column align-items-center w-full"
           [class.nm-page-pad]="!isLanding() && !isApp()"
           style="flex: 1">
        <div class="w-full" [style.max-width]="containerMaxWidth()">
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

      <!-- Dialog suppression de compte -->
      <p-dialog [header]="'APP.DELETE_ACCOUNT_TITLE' | translate"
                [visible]="showDeleteAccountDialog()"
                (visibleChange)="showDeleteAccountDialog.set($event)"
                [modal]="true"
                [style]="{ width: 'min(26rem, 92vw)' }"
                [draggable]="false"
                [resizable]="false">
        <div style="display: flex; flex-direction: column; gap: 1rem">
          <p style="margin: 0; font-size: 0.9rem; color: var(--p-surface-600)">
            {{ 'APP.DELETE_ACCOUNT_MSG' | translate }}
          </p>
          <div style="display: flex; justify-content: flex-end; gap: 0.5rem">
            <p-button
              [label]="'APP.CANCEL' | translate"
              severity="secondary"
              [text]="true"
              (onClick)="showDeleteAccountDialog.set(false)">
            </p-button>
            <p-button
              [label]="'APP.DELETE_ACCOUNT_BTN' | translate"
              severity="danger"
              icon="pi pi-trash"
              [loading]="deleteAccountLoading()"
              (onClick)="deleteAccount()">
            </p-button>
          </div>
        </div>
      </p-dialog>

      <!-- Le pied de page portait « text-400 » (une nuance décorative : 1,31:1 sur
           blanc) et un « background: white » en dur, qui l'excluait du thème. -->
      <footer class="mt-8 py-6 border-top-1 border-solid text-center text-sm"
              style="background: var(--nm-app-surface); color: var(--nm-app-text-2); border-color: var(--nm-app-border)">
        <!--
          Le sélecteur de thème vit dans le menu du compte : ce n'est pas une
          action fréquente, et la barre de menu doit rester celle des actions
          du produit. Reste le cas du visiteur sans compte, qui n'a pas ce
          menu — il le retrouve ici, sur les pages de contenu qui suivent bien
          le thème (mentions, guides, comparatifs).
        -->
        <div *ngIf="!isLoggedIn()" class="theme-switch theme-switch--foot" role="group"
             [attr.aria-label]="'APP.THEME' | translate">
          @for (t of themeChoices; track t.key) {
            <button type="button"
                    class="theme-switch__btn"
                    [class.theme-switch__btn--on]="theme.choice() === t.key"
                    [attr.aria-pressed]="theme.choice() === t.key"
                    [attr.title]="t.label | translate"
                    (click)="theme.set(t.key)">{{ t.short | translate }}</button>
          }
        </div>

        <div class="mb-2 font-bold text-500">Namorama &copy; 2026</div>
        <!--
          Une vraie liste, et non une phrase ponctuée de « · » : au pli du
          téléphone, « Mentions légales » se coupait en deux lignes et chaque
          lien ne mesurait que 16 px de haut. Les séparateurs sont posés par le
          CSS, qui les retire quand les liens s'empilent.
        -->
        <nav class="nm-foot__links" [attr.aria-label]="'APP.FOOTER' | translate">
          <span class="nm-foot__by">
            {{ 'APP.FOOTER' | translate }}
            <a href="https://neolegal.fr" target="_blank" rel="noopener">NeoLegal</a>
          </span>
          <button type="button" (click)="openFeedback()">{{ 'APP.FEEDBACK' | translate }}</button>
          <a routerLink="/legal">{{ 'APP.LEGAL' | translate }}</a>
          <a routerLink="/privacy">{{ 'APP.PRIVACY' | translate }}</a>
        </nav>
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
  
  /**
   * DEUX langues proposées, et non dix-neuf.
   *
   * Les dix-sept autres n'avaient que 158 des 456 clés : deux tiers de chaque
   * écran retombaient sur le repli, et l'utilisateur lisait un produit
   * mi-traduit. Mieux vaut ne pas proposer une langue que la proposer au
   * tiers — surtout sur des écrans qui facturent et qui portent des verdicts
   * juridiques.
   *
   * Les fichiers restent dans `public/assets/i18n/` : rouvrir une langue une
   * fois complétée ne coûte qu'une ligne ici et une dans `supportedLangs`.
   */
  readonly languages = [
    { label: 'Français',   code: 'fr' },
    { label: 'English',    code: 'en' },
  ];

  readonly langMenuItems: MenuItem[] = this.languages.map(l => ({
    label: l.label,
    command: () => this.setLang(l.code)
  }));

  /** Nom de la langue courante, dans sa propre langue. */
  get currentLangLabel(): string {
    return this.languages.find(l => l.code === this.selectedLang)?.label ?? 'Français';
  }

  profileMenuItems: MenuItem[] = [];
  projectMenuItems: MenuItem[] = [];
  adminMenuItems: MenuItem[] = [
    { label: 'Dashboard',    icon: 'pi pi-chart-bar', command: () => this.router.navigate(['/admin/dashboard']) },
    { label: 'Utilisateurs', icon: 'pi pi-users',     command: () => this.router.navigate(['/admin/users']) },
    { label: 'Feedbacks',    icon: 'pi pi-comment',   command: () => this.router.navigate(['/admin/feedback']) },
  ];

  /** Panneau de compte mobile (bottom sheet). */
  showAccountSheet = signal(false);

  /**
   * Sous 640 px, l'avatar ouvre le panneau ancré en bas ; au-delà, le menu
   * déroulant habituel. Le test se fait au clic — donc toujours côté
   * navigateur — et non au rendu, qui doit rester identique au prérendu SSG.
   */
  openAccountMenu(event: Event, desktopMenu: { toggle: (e: Event) => void }) {
    const isMobile = typeof window !== 'undefined'
      && window.matchMedia('(max-width: 640px)').matches;
    if (isMobile) {
      this.showAccountSheet.set(true);
    } else {
      desktopMenu.toggle(event);
    }
  }

  /**
   * Ferme le panneau AVANT d'exécuter l'action : sans ça, ouvrir le dialogue
   * de crédits par-dessus superpose deux overlays et verrouille deux fois le
   * défilement de la page.
   */
  private fromSheet(action: () => void) {
    this.showAccountSheet.set(false);
    setTimeout(() => action());
  }

  sheetCredits()    { this.fromSheet(() => this.triggerCreditDialog()); }
  sheetNewProject() { this.fromSheet(() => this.newProject()); }
  sheetProjects()   { this.fromSheet(() => this.openProjects()); }
  sheetLogout()     { this.fromSheet(() => this.logout()); }

  /** Console de gestion de compte Keycloak (mot de passe, e-mail, 2FA). */
  sheetAccount() {
    this.fromSheet(() => this.keycloak.getKeycloakInstance().accountManagement());
  }

  /** Entrée d'administration : les commandes viennent du menu existant. */
  sheetAdmin(item: MenuItem) {
    this.fromSheet(() => item.command?.({ item } as any));
  }

  // Feedback
  showFeedbackDialog = signal(false);
  feedbackMessage = '';
  feedbackEmail = '';
  feedbackLoading = signal(false);

  // Suppression de compte
  showDeleteAccountDialog = signal(false);
  deleteAccountLoading = signal(false);

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
    private analytics: AnalyticsService,
    @Inject(PLATFORM_ID) private platformId: Object,
  ) {}

  async ngOnInit() {
    // Langue (sans accès navigateur) — utile au prerender SSG de la landing.
    const lang = this.translate.currentLang() || 'fr';
    this.currentLang.set(lang);
    this.selectedLang = lang;

    // Tout le reste dépend du navigateur (cookie consent, Keycloak, document,
    // gtag) : on l'ignore côté serveur pour ne pas casser le prerender.
    if (!isPlatformBrowser(this.platformId)) return;

    document.documentElement.lang = lang;
    this.cookieConsent.init();
    this.isLoggedIn.set(await this.keycloak.isLoggedIn());
    this.isAdmin.set(this.keycloak.isUserInRole('admin'));

    this.suivreLesPages();

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

  /**
   * Dernier chemin compté, pour ne pas compter deux fois la même page.
   *
   * L'affichage initial est signalé ici même ; `NavigationEnd` le rejoue
   * parfois pour la route de départ, et un rechargement de la page suffirait
   * sinon à doubler la première visite.
   */
  private dernierChemin = '';

  /**
   * Compte les affichages de page — le dénominateur de tout l'entonnoir.
   *
   * Appelé une fois que Keycloak a répondu : `connecte` distingue les visites
   * arrivées avec une session ouverte, qui ne peuvent pas créer de compte et
   * fausseraient le taux d'inscription si on les mélangeait aux autres.
   *
   * Aucun cookie, aucun consentement requis : c'est la seule mesure qui voie
   * les visiteurs partis avant d'avoir cliqué sur quoi que ce soit.
   */
  private suivreLesPages(): void {
    const compter = (chemin: string) => {
      if (chemin === this.dernierChemin) return;
      this.dernierChemin = chemin;
      this.analytics.pageView(chemin, this.isLoggedIn());
    };

    compter(this.router.url.split('?')[0]);
    this.router.events.subscribe(e => {
      if (e instanceof NavigationEnd) compter(e.urlAfterRedirects.split('?')[0]);
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
    this.translate.get([
      'APP.CREDITS', 'APP.LOGOUT', 'APP.MANAGE_ACCOUNT', 'APP.DELETE_ACCOUNT',
      'APP.THEME', 'APP.THEME_SYSTEM', 'APP.THEME_LIGHT', 'APP.THEME_DARK',
    ]).subscribe(res => {
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
              label: res['APP.DELETE_ACCOUNT'],
              icon: 'pi pi-trash',
              command: () => this.showDeleteAccountDialog.set(true)
            },
            {
              label: res['APP.LOGOUT'],
              icon: 'pi pi-sign-out',
              command: () => this.logout()
            }
          ]
        },
        /*
         * Le thème descend ici depuis la barre de menu : trois états à demeure
         * dans l'en-tête pour un réglage qu'on touche une fois, cela pesait
         * autant que « Projets ». Groupe distinct, et non items mêlés au
         * compte : ce n'est pas une action sur le compte.
         *
         * L'état courant se lit à l'icône, qui passe à la coche — un menu
         * n'ayant pas d'état pressé, il faut le dire dans l'item lui-même.
         */
        {
          label: res['APP.THEME'],
          items: this.themeChoices.map((t) => ({
            label: res[t.label],
            icon: this.theme.choice() === t.key ? 'pi pi-check' : THEME_ICONS[t.key],
            styleClass: this.theme.choice() === t.key ? 'menu-item--on' : undefined,
            command: () => { this.theme.set(t.key); this.updateProfileMenu(); },
          })),
        },
      ];
      this.cdr.detectChanges();
    });
  }

  /**
   * Ouvre le dialogue d'achat depuis la pastille de crédits.
   *
   * Tracé, comme les autres ouvertures : ce chemin n'émettait rien du tout
   * alors qu'il porte le seul revenu du produit. Le solde part avec
   * l'événement — c'est lui qui distingue « je regarde les packs » de « je
   * viens de taper le mur ».
   */
  triggerCreditDialog() {
    this.analytics.track('credits_dialog_opened', { origine: 'pastille', solde: this.credits() });
    this.userService.getCredits().subscribe();
    this.userService.getSubscription().subscribe();
    this.projectService.showCreditDialog.set(true);
    this.cdr.detectChanges();
  }

  onBillingDialogVisibilityChange(visible: boolean) {
    this.projectService.showCreditDialog.set(visible);
  }

  buyPack(packType: PackType) {
    // Dernier geste avant de quitter l'application pour Stripe : c'est le seul
    // endroit qui distingue une intention d'achat d'un simple coup d'œil aux
    // packs, et l'écart entre les deux est la mesure qui manquait.
    this.analytics.track('pack_checkout_started', { pack: packType, solde: this.credits() });
    this.billingLoading.set(packType);
    this.paymentService.createPackCheckout(packType).subscribe({
      next: ({ url }) => { window.location.href = url; },
      error: () => {
        this.billingLoading.set(false);
        this.analytics.track('pack_checkout_failed', { pack: packType });
      },
    });
  }

  /**
   * Le sélecteur est désormais la SEULE affordance de langue.
   *
   * Le lien « This page in English » du pied de l'accueil a disparu : deux
   * commandes pour un même effet, dont l'une exigeait de dérouler toute la
   * page. Mais elles ne faisaient pas la même chose — le lien changeait
   * d'URL, le sélecteur non. Garder le seul sélecteur tel quel aurait servi
   * l'anglais sous « / », une adresse que son canonical et ses hreflang
   * déclarent française.
   *
   * Sur les deux pages qui ont une URL par langue, le sélecteur NAVIGUE donc.
   * Partout ailleurs il bascule le dictionnaire, comme avant : les guides
   * n'existent qu'en français, leur donner une adresse anglaise créerait du
   * contenu dupliqué.
   */
  setLang(lang: string) {
    const chemin = this.router.url.split('?')[0].split('#')[0].replace(/\/$/, '') || '/';
    if (chemin === '/' || chemin === '/en') {
      // `WizardReuseStrategy` ne réutilise PAS `LandingComponent` entre ces
      // deux routes : l'instance est recréée et redécide sa langue depuis
      // l'URL, métadonnées et hreflang compris.
      void this.router.navigateByUrl(lang === 'en' ? '/en' : '/');
      return;
    }
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
      // Les projets reçus en partage se chargent en même temps : le tiroir doit
      // les montrer dès son ouverture, sinon l'invité ne sait pas où aller.
      this.projectService.refreshSharedProjects().subscribe({ error: () => undefined });
      this.projectService.showDrawer.set(true);
    };
    if (this.router.url.startsWith('/app')) {
      show();
    } else {
      this.router.navigate(['/app']).then(() => setTimeout(show, 100));
    }
  }

  newProject() {
    if (this.router.url.startsWith('/app')) {
      this.projectService.resetWizard();
    } else {
      this.router.navigate(['/app']).then(() => setTimeout(() => this.projectService.resetWizard(), 100));
    }
  }

  login() {
    // Le produit ne sert que `fr` et `en` : plus de conversion BCP47 pour le
    // chinois, dont le dictionnaire n'existe plus.
    this.keycloak.login({ locale: this.selectedLang });
  }

  logout() {
    this.keycloak.logout(window.location.origin);
  }

  deleteAccount() {
    this.deleteAccountLoading.set(true);
    this.userService.deleteAccount().subscribe({
      next: () => {
        this.showDeleteAccountDialog.set(false);
        this.keycloak.logout(window.location.origin);
      },
      error: () => {
        this.deleteAccountLoading.set(false);
      },
    });
  }

  /** Sélecteur de thème — « Système » d'abord, c'est le défaut. */
  /** Public : le gabarit lit `theme.choice()` et appelle `theme.set()`. */
  readonly theme = inject(ThemeService);

  themeIcon(key: 'system' | 'light' | 'dark'): string {
    return THEME_ICONS[key];
  }

  readonly themeChoices = [
    { key: 'system' as const, label: 'APP.THEME_SYSTEM', short: 'APP.THEME_SYSTEM_SHORT' },
    { key: 'light'  as const, label: 'APP.THEME_LIGHT',  short: 'APP.THEME_LIGHT_SHORT' },
    { key: 'dark'   as const, label: 'APP.THEME_DARK',   short: 'APP.THEME_DARK_SHORT' },
  ];

  goToHome() {
    this.router.navigate(['/']);
  }

  /**
   * L'accueil est le seul écran à sortir du gabarit commun : héros sombre
   * pleine largeur, sections claires de bord à bord, largeur maximale portée
   * par le composant lui-même.
   *
   * Comparaison sur le chemin seul : `router.url` porte les paramètres de
   * requête, et « / » suivi d'un `?utm_source=…` — le cas de figure de toute
   * campagne d'acquisition — ne serait sinon plus reconnu comme l'accueil.
   */
  /**
   * Le wizard porte lui-même sa largeur, comme l'accueil.
   *
   * Il était enfermé dans le conteneur commun à 44rem (704px) : sur un écran
   * de 1440px, la grille de résultats n'en occupait donc que la moitié, et
   * n'affichait que deux colonnes de cartes là où le design en prévoit
   * quatre — d'où des cartes serrées et une page qui paraît étriquée. Ses
   * étapes ont des besoins opposés : une colonne étroite se lit mieux pour
   * décrire un projet, une grille large se compare mieux.
   */
  isApp(): boolean {
    const path = this.router.url.split('?')[0].split('#')[0];
    return path === '/app' || path.startsWith('/projects/');
  }

  containerMaxWidth(): string | null {
    if (this.isLanding() || this.isApp()) return null;
    return this.router.url.startsWith('/admin') ? '72rem' : '44rem';
  }

  isLanding(): boolean {
    const path = this.router.url.split('?')[0].split('#')[0];
    return path === '/' || path === '/en';
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