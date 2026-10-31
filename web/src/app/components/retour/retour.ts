import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { ConfigService } from '../../services/config';

type Etat = 'chargement' | 'merci' | 'deja' | 'desinscrit' | 'invalide' | 'erreur';

/**
 * Pages des liens de la demande de retour (chantier `demande-de-retour-automatique`) :
 * `/retour?j=…` (« Namorama vous a-t-il été utile ? ») et `/desinscription?j=…`.
 *
 * C'est la page, une fois EXÉCUTÉE, qui enregistre la réponse — jamais le
 * simple chargement du lien : les antivirus de messagerie suivent les liens
 * d'un courriel, et chaque courriel délivré vaudrait sinon un « oui » et
 * 100 crédits. Le jeton signé tient lieu de connexion.
 */
@Component({
  selector: 'app-retour',
  standalone: true,
  imports: [CommonModule, TranslatePipe, ButtonModule, RouterLink],
  template: `
    <main class="retour-page">
      <ng-container [ngSwitch]="etat()">
        <ng-container *ngSwitchCase="'chargement'">
          <i class="pi pi-spin pi-spinner retour-page__icone" aria-hidden="true"></i>
          <p class="retour-page__texte">{{ 'RETOUR.LOADING' | translate }}</p>
        </ng-container>

        <ng-container *ngSwitchCase="'merci'">
          <i class="pi pi-check-circle retour-page__icone retour-page__icone--ok" aria-hidden="true"></i>
          <h1 class="retour-page__titre">{{ 'RETOUR.THANKS_TITLE' | translate }}</h1>
          <p class="retour-page__credits">{{ 'RETOUR.CREDITS_ADDED' | translate: { n: credits() } }}</p>
          <p class="retour-page__texte">{{ (reponse() === 'non' ? 'RETOUR.MORE_NO' : 'RETOUR.MORE_YES') | translate }}</p>
          <p-button [label]="'RETOUR.MORE_CTA' | translate" icon="pi pi-comment" (onClick)="direPlus()"></p-button>
        </ng-container>

        <ng-container *ngSwitchCase="'deja'">
          <i class="pi pi-info-circle retour-page__icone" aria-hidden="true"></i>
          <h1 class="retour-page__titre">{{ 'RETOUR.ALREADY_TITLE' | translate }}</h1>
          <p class="retour-page__texte">{{ (reponse() === 'non' ? 'RETOUR.MORE_NO' : 'RETOUR.MORE_YES') | translate }}</p>
          <p-button [label]="'RETOUR.MORE_CTA' | translate" icon="pi pi-comment" (onClick)="direPlus()"></p-button>
        </ng-container>

        <ng-container *ngSwitchCase="'desinscrit'">
          <i class="pi pi-envelope retour-page__icone" aria-hidden="true"></i>
          <h1 class="retour-page__titre">{{ 'RETOUR.UNSUBSCRIBED_TITLE' | translate }}</h1>
          <p class="retour-page__texte">{{ 'RETOUR.UNSUBSCRIBED_TEXT' | translate }}</p>
        </ng-container>

        <ng-container *ngSwitchCase="'invalide'">
          <i class="pi pi-times-circle retour-page__icone retour-page__icone--ko" aria-hidden="true"></i>
          <h1 class="retour-page__titre">{{ 'RETOUR.INVALID_TITLE' | translate }}</h1>
          <p class="retour-page__texte">{{ 'RETOUR.INVALID_TEXT' | translate }}</p>
        </ng-container>

        <ng-container *ngSwitchCase="'erreur'">
          <i class="pi pi-exclamation-triangle retour-page__icone retour-page__icone--ko" aria-hidden="true"></i>
          <h1 class="retour-page__titre">{{ 'RETOUR.ERROR_TITLE' | translate }}</h1>
          <p class="retour-page__texte">{{ 'RETOUR.ERROR_TEXT' | translate }}</p>
        </ng-container>
      </ng-container>

      <a *ngIf="etat() !== 'chargement'" class="nm-link retour-page__accueil" routerLink="/">{{ 'RETOUR.HOME' | translate }}</a>
    </main>
  `,
})
export class RetourComponent implements OnInit {
  etat = signal<Etat>('chargement');
  reponse = signal<'oui' | 'non' | null>(null);
  credits = signal(0);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private config: ConfigService,
  ) {}

  ngOnInit() {
    const jeton = this.route.snapshot.queryParamMap.get('j');
    if (!jeton) {
      this.etat.set('invalide');
      return;
    }
    const desinscription = this.router.url.startsWith('/desinscription');
    const url = `${this.config.apiUrl}/retours/${desinscription ? 'desinscription' : 'utilite'}`;
    this.http.post<any>(url, { j: jeton }).subscribe({
      next: (r) => {
        if (desinscription) {
          this.etat.set('desinscrit');
          return;
        }
        this.reponse.set(r?.reponse ?? null);
        this.credits.set(r?.credits ?? 0);
        this.etat.set(r?.dejaRepondu ? 'deja' : 'merci');
      },
      error: (e) => this.etat.set(e?.status === 400 ? 'invalide' : 'erreur'),
    });
  }

  /** Le retour détaillé : le formulaire existant, ouvert après connexion (`?avis=1`). */
  direPlus() {
    void this.router.navigate(['/app'], { queryParams: { avis: 1 } });
  }
}
