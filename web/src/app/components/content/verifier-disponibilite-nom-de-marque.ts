import { Component, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { KeycloakService } from 'keycloak-angular';
import { timeout } from 'rxjs';
import { TroisRisquesComponent } from './trois-risques';
import { ArticleCtaComponent } from './article-cta';
import { applyContentSeo } from './content-seo';
import { ArticleEnteteComponent } from './article-entete';
import { BrandReportViewComponent } from '../brand-report/brand-report-view';
import { BrandReportService, BrandReport, Availability, BRAND_REPORT_COST } from '../../services/brand-report';

/**
 * Landing SEO (US-055) : « vérifier la disponibilité d'un nom de marque ».
 *
 * Intention transactionnelle en français, mal couverte par les outils US.
 * La page est prérendue (contenu indexable) ; le checker d'aperçu s'exécute
 * côté navigateur au clic (aucun appel réseau au prerender). L'aperçu est
 * volontairement bridé (domaine phare + quelques réseaux, sans marque) pour
 * démontrer la valeur et pousser vers le rapport complet.
 */
@Component({
  selector: 'app-verifier-disponibilite-nom-de-marque',
  standalone: true,
  imports: [ArticleEnteteComponent, TroisRisquesComponent, RouterModule, FormsModule, ArticleCtaComponent, BrandReportViewComponent],
  template: `
    <article class="article">
      <app-article-entete>
        <h1>Vérifier la disponibilité d'un nom de marque</h1>
      </app-article-entete>
      <p class="lead">
        Avant de vous engager sur un nom, une question décide de tout&nbsp;: est-il <strong>réellement libre</strong>&nbsp;?
        Pas seulement le domaine — aussi les <strong>réseaux sociaux</strong> et surtout la <strong>marque déposée</strong>
        (INPI en France, EUIPO en Europe). Testez un nom ci-dessous&nbsp;: aperçu immédiat, sans compte.
      </p>

      <!-- Checker d'aperçu (client-side) -->
      <div class="checker">
        <div class="checker-row">
          <input type="text" [(ngModel)]="query" (keyup.enter)="check()"
                 placeholder="Ex. : Qonto, Namorama…" aria-label="Nom à vérifier" maxlength="60" />
          <button (click)="check()" [disabled]="loading() || !query().trim()">
            {{ loading() ? 'Vérification…' : 'Vérifier' }}
          </button>
        </div>

        @if (error()) {
          <p class="checker-error">{{ error() }}</p>
        }

        @if (report(); as r) {
          <div class="checker-result">
            <div class="cols">
              <div>
                <h3>Domaines</h3>
                @for (d of r.domains; track d.domain) {
                  <div class="line"><span>{{ d.domain }}</span> <span class="badge" [style.background]="color(d.status)">{{ label(d.status) }}</span></div>
                }
              </div>
              <div>
                <h3>Réseaux sociaux</h3>
                @for (s of r.socials; track s.platform) {
                  <div class="line"><span>{{ s.platform }}</span> <span class="badge" [style.background]="color(s.status)">{{ label(s.status) }}</span></div>
                }
              </div>
            </div>
            <p class="upsell">
              L'aperçu ne couvre que l'essentiel. Le <strong>rapport complet</strong> ajoute
              tous les réseaux et la <strong>vérification de marque INPI + EUIPO</strong> (classes incluses),
              affiché et envoyé par email — {{ cost }} crédits.
            </p>
            <button class="cta" (click)="getFullReport()" [disabled]="fullLoading()">
              {{ fullLoading() ? 'Génération du rapport…' : (isLoggedIn() ? 'Obtenir le rapport complet' : 'Se connecter pour le rapport complet') }}
            </button>
            @if (fullError()) {
              <p class="checker-error">{{ fullError() }}</p>
              <button class="cta" (click)="getFullReport()" [disabled]="fullLoading()"><i class="pi pi-refresh"></i> Réessayer</button>
            }
          </div>
        }

        <!-- Rapport complet -->
        @if (fullReport(); as fr) {
          <div style="margin-top: 1.5rem">
            <app-brand-report-view [report]="fr"></app-brand-report-view>
          </div>
        }
      </div>

      <h2 id="pourquoi">Domaine libre ne veut pas dire nom disponible</h2>
      <p>
        C'est l'angle mort le plus coûteux d'un lancement&nbsp;: un nom peut être libre en <code>.com</code> et
        <strong>déjà déposé comme marque</strong> dans votre classe de produits. Vous construisez alors une identité
        — logo, site, comptes sociaux, cartes — sur un nom que vous devrez abandonner à la première opposition, en
        perdant les redevances déjà versées. Vérifier la marque <em>avant</em> de s'attacher au nom coûte quelques
        secondes&nbsp;; le corriger après, des mois.
      </p>

      <h2 id="trois-plans">Les trois plans à vérifier</h2>
      <ul>
        <li><strong>Le domaine</strong> — la base, mais la partie la plus simple. Un nom sans <code>.com</code> reste viable&nbsp;;
          un nom déjà déposé en marque, non.</li>
        <li><strong>Les réseaux sociaux</strong> — un handle cohérent (GitHub, LinkedIn, Telegram, TikTok, X, YouTube) fait gagner
          en clarté de marque. Les pseudos identiques partent vite.</li>
        <li><strong>La marque déposée</strong> — le seul plan à portée juridique. Nous interrogeons les bases officielles
          <strong>INPI (France)</strong> et <strong>EUIPO (Union européenne)</strong>
          pour signaler les dépôts identiques ou proches, avec leurs <strong>classes de Nice</strong>.</li>
      </ul>

      <h2 id="indicatif">Un signal indicatif, pas un avis juridique</h2>
      <p>
        Notre vérification est un <strong>signal de disponibilité</strong> destiné à écarter très tôt les noms
        manifestement pris. Elle ne remplace pas une <strong>recherche d'antériorité</strong> complète (qui couvre aussi
        les similarités phonétiques et visuelles) ni l'avis d'un <strong>conseil en propriété industrielle</strong>. Pour
        un dépôt, appuyez-vous sur la recherche officielle de l'INPI et, au besoin, un professionnel — nous vous y
        renvoyons systématiquement. Le détail de la démarche, des classes de Nice et de ce que la recherche
        gratuite ne couvre pas est expliqué dans notre guide de la
        <a routerLink="/recherche-anteriorite-marque-inpi">recherche d'antériorité à l'INPI</a>.
      </p>

      <h2 id="comment">Comment ça marche</h2>
      <p>
        Saisissez un nom&nbsp;: nous vérifions le domaine par une requête réelle, la disponibilité des handles sociaux,
        et interrogeons les bases de marques. Le résultat est synthétisé en un <strong>score de disponibilité</strong> et,
        pour le rapport complet, <strong>envoyé par email</strong> — un document que vous pouvez archiver ou partager avec
        un associé ou votre avocat.
      </p>

      <app-trois-risques intro="« Disponible » ne veut pas dire la même chose selon ce qu'on vérifie. Ces trois contrôles couvrent trois risques distincts."></app-trois-risques>

      <app-article-cta
        heading="Vérifiez votre nom de marque maintenant"
        subheading="Domaine, réseaux sociaux et marque déposée (INPI + EUIPO) en un seul rapport."
        label="Lancer une vérification"></app-article-cta>

      <h2 id="faq">Questions fréquentes</h2>
      <h3>Comment savoir si un nom de marque est disponible à l'INPI&nbsp;?</h3>
      <p>
        La base des marques de l'INPI est publique et gratuite&nbsp;: une recherche à l'identique y écarte les
        noms manifestement pris. Deux réserves, et elles comptent&nbsp;: elle ne couvre pas les
        <strong>similarités</strong> (un nom proche suffit à créer un risque de confusion), ni les
        <strong>marques de l'Union européenne</strong> déposées à l'EUIPO, qui produisent pourtant leurs effets
        en France. Notre rapport interroge les deux bases d'un coup.
      </p>
      <h3>Vérifier un nom de société, est-ce la même chose&nbsp;?</h3>
      <p>
        Non, et c'est une confusion coûteuse. Une dénomination sociale s'apprécie au registre du commerce et ne
        vous protège que faiblement, sur votre secteur et votre zone. Créer la société ne réserve pas le
        nom&nbsp;: seul le dépôt de marque donne un monopole. Un nom peut donc être libre au greffe et
        totalement bloqué par une marque antérieure.
      </p>
      <h3>Que faire si un dépôt proche apparaît&nbsp;?</h3>
      <p>
        Regardez d'abord les <strong>classes</strong> et la date&nbsp;: un nom identique dans un secteur
        éloigné du vôtre coexiste souvent sans difficulté, et une marque non renouvelée au bout de dix ans a pu
        tomber. Si le dépôt vise vos produits ou services, considérez le nom comme perdu et passez au suivant —
        ou faites trancher par un conseil en propriété industrielle avant d'investir quoi que ce soit.
      </p>

      <h2 id="aussi">À lire aussi</h2>
      <ul>
        <li><a routerLink="/guides/trouver-nom-de-marque">Guide&nbsp;: trouver un nom de marque disponible</a></li>
        <li><a routerLink="/recherche-anteriorite-marque-inpi">Recherche d'antériorité de marque (INPI)</a></li>
        <li><a routerLink="/generateur-nom-de-marque">Générateur de nom de marque</a></li>
        <li><a routerLink="/generateur-nom-de-produit">Générateur de nom de produit</a></li>
        <li><a routerLink="/nom-de-startup-court-invente">Noms courts et inventés, façon Qonto ou Stripe</a></li>
        <li><a routerLink="/comparatif-generateurs-de-noms">Comparatif des générateurs de noms</a></li>
      </ul>
    </article>
  `,
  styles: [`
    .checker { margin: 1.5rem 0 2rem; padding: 1.25rem; border: 1px solid #e5e7eb; border-radius: 12px; background: #f9fafb; }
    .checker-row { display: flex; gap: 0.5rem; flex-wrap: wrap; }
    .checker-row input { flex: 1 1 200px; padding: 0.6rem 0.8rem; border: 1px solid #d1d5db; border-radius: 8px; font-size: 1rem; }
    .checker-row button { padding: 0.6rem 1.2rem; border: 0; border-radius: 8px; background: var(--nm-app-accent-fill); color: var(--nm-app-on-accent); font-weight: 600; cursor: pointer; }
    .checker-row button:disabled { opacity: .6; cursor: default; }
    .checker-error { color: #dc2626; margin: 0.75rem 0 0; }
    .checker-result { margin-top: 1rem; }
    .checker-result .cols { display: flex; gap: 2rem; flex-wrap: wrap; }
    .checker-result .cols > div { flex: 1 1 220px; }
    .checker-result h3 { font-size: 0.9rem; margin: 0 0 0.5rem; }
    .line { display: flex; justify-content: space-between; align-items: center; padding: 0.25rem 0; font-size: 0.9rem; border-bottom: 1px solid #eef0f2; }
    .badge { color: #fff; font-size: 0.72rem; font-weight: 600; padding: 2px 10px; border-radius: 9999px; }
    .upsell { font-size: 0.9rem; color: #4b5563; margin: 1rem 0 0.75rem; }
    .cta { display: inline-block; background: #111827; color: #fff; text-decoration: none; padding: 0.6rem 1.1rem; border-radius: 8px; font-weight: 600; }
  `],
})
export class VerifierDisponibiliteMarqueComponent {
  private readonly router = inject(Router);
  private readonly reports = inject(BrandReportService);

  readonly query = signal('');
  readonly loading = signal(false);
  readonly report = signal<BrandReport | null>(null);
  readonly error = signal<string | null>(null);
  readonly cost = BRAND_REPORT_COST;

  // Rapport complet pour un nom saisi — nécessite un compte + crédits.
  private keycloak?: KeycloakService;
  readonly isLoggedIn = signal(false);
  readonly fullLoading = signal(false);
  readonly fullReport = signal<BrandReport | null>(null);
  readonly fullError = signal<string | null>(null);

  constructor() {
    applyContentSeo({
      title: 'Vérifier la disponibilité d’un nom de marque',
      description:
        'Vérifiez si un nom de marque est disponible : domaine, réseaux sociaux et marque déposée (INPI + EUIPO). Aperçu immédiat, sans compte, et rapport complet.',
      path: '/verifier-disponibilite-nom-de-marque',
    });
    // Uniquement côté navigateur : au prerender, Keycloak n'est pas initialisé.
    if (isPlatformBrowser(inject(PLATFORM_ID))) {
      this.keycloak = inject(KeycloakService);
      try { this.isLoggedIn.set(this.keycloak.isLoggedIn()); } catch { this.isLoggedIn.set(false); }
    }
  }

  /** Génère le Rapport complet pour le nom saisi. */
  getFullReport(): void {
    const name = this.query().trim();
    if (!name || this.fullLoading()) return;
    // Non connecté : rediriger vers la connexion puis revenir sur cette page.
    if (!this.isLoggedIn()) {
      this.keycloak?.login({ redirectUri: typeof window !== 'undefined' ? window.location.href : undefined });
      return;
    }
    this.fullLoading.set(true);
    this.fullError.set(null);
    this.fullReport.set(null);
    this.reports.full(name).pipe(timeout(90000)).subscribe({
      next: (r) => { this.fullReport.set(r); this.fullLoading.set(false); },
      error: (err) => {
        this.fullError.set(
          err?.status === 403
            ? `Crédits insuffisants (${this.cost} crédits requis). Rechargez votre solde pour générer le rapport complet.`
            : 'La génération du rapport a échoué. Réessayez dans un instant.',
        );
        this.fullLoading.set(false);
      },
    });
  }

  /**
   * Le contrôle inline part vers le rapport public.
   *
   * Il avait son propre aperçu — un seul domaine, trois réseaux, et un rendu
   * qui ne ressemblait à aucun autre écran du produit. Deux pages disaient
   * donc la même chose de deux façons. Celle-ci garde son contenu éditorial,
   * qui est sa raison d'être, et confie la réponse à la page qui sait la
   * donner : quatre extensions, la même mise en forme que le rapport acheté,
   * et la suite proposée au bon moment.
   */
  check(): void {
    const name = this.query().trim();
    if (!name) return;
    void this.router.navigate(['/report'], { queryParams: { name } });
  }

  private checkAncien(): void {
    const name = this.query().trim();
    if (!name || this.loading()) return;
    this.loading.set(true);
    this.error.set(null);
    this.report.set(null);
    this.reports.preview(name).subscribe({
      next: (r) => {
        this.report.set(r);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('La vérification a échoué. Réessayez dans un instant.');
        this.loading.set(false);
      },
    });
  }

  label(s: Availability): string {
    return s === 'free' ? 'Libre' : s === 'taken' ? 'Pris' : '?';
  }

  color(s: Availability): string {
    return s === 'free' ? '#16a34a' : s === 'taken' ? '#dc2626' : '#9ca3af';
  }
}
