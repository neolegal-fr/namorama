import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialog } from 'primeng/confirmdialog';
import {
  AdminArticlesService,
  type ArticleRedaction,
  type EtatArticle,
  type JetonRedaction,
  lireErreur,
} from '../../services/admin-articles.service';
import { dateLongue } from '../content/articles';

export const LIBELLES_ETAT: Record<EtatArticle, { libelle: string; icone: string }> = {
  brouillon: { libelle: 'Brouillon', icone: 'pi pi-pencil' },
  programme: { libelle: 'Programmé', icone: 'pi pi-clock' },
  publie: { libelle: 'Publié', icone: 'pi pi-check' },
};

/**
 * Administration → Articles : les articles du blog, en base (chantier
 * `articles-en-base`), et les jetons de rédaction qui permettent à Claude d'en écrire.
 *
 * Un article se corrige et se publie ici sans déploiement. La valeur d'un jeton n'est
 * montrée qu'une fois, à sa création : l'API n'en garde que l'empreinte.
 */
@Component({
  selector: 'app-admin-articles',
  standalone: true,
  imports: [FormsModule, RouterModule, ButtonModule, DialogModule, ConfirmDialog],
  templateUrl: './admin-articles.component.html',
  styleUrl: './admin-articles.component.css',
})
export class AdminArticlesComponent implements OnInit {
  private readonly service = inject(AdminArticlesService);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);
  private readonly confirmation = inject(ConfirmationService);

  readonly etats = LIBELLES_ETAT;
  readonly ordreEtats: readonly EtatArticle[] = ['publie', 'programme', 'brouillon'];
  readonly date = dateLongue;
  readonly articles = signal<ArticleRedaction[] | null>(null);
  readonly erreur = signal<string | null>(null);
  readonly filtre = signal<EtatArticle | null>(null);
  readonly visibles = computed(() => {
    const f = this.filtre();
    const tous = this.articles() ?? [];
    return f ? tous.filter((a) => a.etat === f) : tous;
  });
  readonly compte = (e: EtatArticle) => (this.articles() ?? []).filter((a) => a.etat === e).length;

  readonly jetons = signal<JetonRedaction[]>([]);
  readonly dialogueJeton = signal(false);
  nomDuJeton = '';
  readonly jetonCree = signal<(JetonRedaction & { valeur: string }) | null>(null);
  readonly creation = signal(false);

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.service.lister$().subscribe({
      next: (a) => this.articles.set(a),
      error: (e) => this.erreur.set(String(lireErreur(e).message)),
    });
    this.service.jetons$().subscribe({ next: (j) => this.jetons.set(j) });
  }

  ouvrir(a: ArticleRedaction): void {
    this.router.navigate(['/admin/articles', a.id]);
  }

  /** Date et heure d'une modification, en clair. */
  quand(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return `${d.toLocaleDateString('fr-FR')} ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  }

  // ── Jetons ────────────────────────────────────────────────────────────────

  ouvrirCreation(): void {
    this.nomDuJeton = '';
    this.jetonCree.set(null);
    this.dialogueJeton.set(true);
  }

  creerJeton(): void {
    const nom = this.nomDuJeton.trim();
    if (!nom || this.creation()) return;
    this.creation.set(true);
    this.service.creerJeton$(nom).subscribe({
      next: (j) => {
        this.jetonCree.set(j);
        this.creation.set(false);
        this.service.jetons$().subscribe({ next: (l) => this.jetons.set(l) });
      },
      error: (e) => {
        this.creation.set(false);
        this.messages.add({ key: 'app', severity: 'error', summary: 'Jeton non créé', detail: String(lireErreur(e).message) });
      },
    });
  }

  copier(valeur: string): void {
    navigator.clipboard?.writeText(valeur).then(
      () => this.messages.add({ key: 'app', severity: 'success', summary: 'Jeton copié', detail: 'Collez-le dans NAMORAMA_JETON_ARTICLES.' }),
      () => this.messages.add({ key: 'app', severity: 'warn', summary: 'Copie impossible', detail: 'Sélectionnez la valeur et copiez-la à la main.' }),
    );
  }

  revoquer(j: JetonRedaction): void {
    this.confirmation.confirm({
      key: 'articles',
      header: 'Révoquer ce jeton ?',
      message: `« ${j.nom} » ne pourra plus lire ni écrire d'article, dès la requête suivante. Ce qu'il a déjà écrit reste en place.`,
      acceptLabel: 'Révoquer',
      rejectLabel: 'Annuler',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () =>
        this.service.revoquerJeton$(j.id).subscribe({
          next: () => this.service.jetons$().subscribe({ next: (l) => this.jetons.set(l) }),
          error: (e) => this.messages.add({ key: 'app', severity: 'error', summary: 'Révocation impossible', detail: String(lireErreur(e).message) }),
        }),
    });
  }
}
