import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subject, catchError, debounceTime, of, switchMap } from 'rxjs';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { DialogModule } from 'primeng/dialog';
import { Drawer } from 'primeng/drawer';
import {
  AdminArticlesService,
  type ArticleRedaction,
  type RevisionArticle,
  type VerificationArticle,
  gabaritDArticle,
  lireErreur,
} from '../../services/admin-articles.service';
import { ArticleCorpsComponent } from '../content/article-corps';
import { dateLongue } from '../content/articles';
import { LIBELLES_ETAT } from './admin-articles.component';

/** Délai entre la dernière frappe et la vérification (aperçu). */
export const DELAI_VERIFICATION_MS = 500;

/** Date du jour à Paris, AAAA-MM-JJ : la date d'un nouvel article. */
function aujourdhuiAParis(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
}

/**
 * Éditeur d'un article du blog (chantier `articles-en-base`) : Markdown à gauche, aperçu
 * à droite, rendu par le composant de la page publique. Le texte est vérifié par l'API
 * pendant la frappe ; un texte refusé affiche ses causes à la place de l'aperçu, et ne
 * s'enregistre pas.
 *
 * Un enregistrement cite la révision sur laquelle il a été écrit : si Claude (ou un autre
 * onglet) a modifié l'article entre-temps, l'API refuse (409) et rien n'est écrasé — le
 * texte reste dans l'éditeur, et la version en ligne peut être consultée à côté.
 */
@Component({
  selector: 'app-admin-article-editeur',
  standalone: true,
  imports: [FormsModule, RouterModule, ConfirmDialog, DialogModule, Drawer, ArticleCorpsComponent],
  templateUrl: './admin-article-editeur.component.html',
  styleUrl: './admin-article-editeur.component.css',
})
export class AdminArticleEditeurComponent implements OnInit {
  private readonly service = inject(AdminArticlesService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly detruit = inject(DestroyRef);

  readonly etats = LIBELLES_ETAT;
  readonly date = dateLongue;

  readonly article = signal<ArticleRedaction | null>(null);
  readonly chargement = signal(true);
  readonly source = signal('');
  /** Texte tel qu'enregistré : sert à savoir s'il reste des modifications. */
  readonly sourceEnregistree = signal('');
  readonly verification = signal<VerificationArticle | null>(null);
  readonly verificationEnCours = signal(false);
  readonly enregistrement = signal(false);
  readonly conflit = signal<{ revision: number; auteur: string } | null>(null);
  /** Refus d'une action (publication, dépublication) : causes à afficher. */
  readonly refus = signal<{ titre: string; causes: string[] } | null>(null);
  /** Téléphone : un seul des deux volets est visible. */
  readonly volet = signal<'markdown' | 'apercu'>('markdown');

  readonly historiqueOuvert = signal(false);
  readonly revisions = signal<RevisionArticle[]>([]);
  readonly versionEnLigne = signal<{ titre: string; source: string; revision: number } | null>(null);

  readonly modifie = computed(() => this.source() !== this.sourceEnregistree());
  readonly valide = computed(() => this.verification()?.ok === true);
  readonly apercu = computed(() => {
    const v = this.verification();
    return v?.ok ? v.article : null;
  });
  readonly causes = computed(() => {
    const v = this.verification();
    return v && !v.ok ? v.causes : [];
  });
  readonly nouveau = computed(() => this.article() === null);

  private readonly aVerifier = new Subject<string>();

  ngOnInit(): void {
    this.aVerifier
      .pipe(
        debounceTime(DELAI_VERIFICATION_MS),
        switchMap((source) => {
          this.verificationEnCours.set(true);
          return this.service.verifier$(source, this.article()?.id).pipe(
            catchError((e) => {
              const err = lireErreur(e);
              return of<VerificationArticle>({ ok: false, causes: err.causes ?? [String(err.message)] });
            }),
          );
        }),
        takeUntilDestroyed(this.detruit),
      )
      .subscribe((v) => {
        this.verification.set(v);
        this.verificationEnCours.set(false);
      });

    const id = this.route.snapshot.paramMap.get('id');
    if (!id || id === 'nouveau') {
      const gabarit = gabaritDArticle(aujourdhuiAParis());
      this.source.set(gabarit);
      this.sourceEnregistree.set('');
      this.chargement.set(false);
      this.aVerifier.next(gabarit);
      return;
    }
    this.charger(Number(id));
  }

  private charger(id: number): void {
    this.chargement.set(true);
    this.service.lire$(id).subscribe({
      next: (a) => {
        this.article.set(a);
        this.source.set(a.source);
        this.sourceEnregistree.set(a.source);
        this.chargement.set(false);
        this.conflit.set(null);
        this.aVerifier.next(a.source);
      },
      error: (e) => {
        this.chargement.set(false);
        this.messages.add({ key: 'app', severity: 'error', summary: 'Article introuvable', detail: String(lireErreur(e).message) });
        this.router.navigate(['/admin/articles']);
      },
    });
  }

  saisir(texte: string): void {
    this.source.set(texte);
    this.refus.set(null);
    this.aVerifier.next(texte);
  }

  enregistrer(): void {
    if (!this.valide() || !this.modifie() || this.enregistrement()) return;
    const a = this.article();
    this.enregistrement.set(true);
    this.service.enregistrer$(this.source(), a?.id, a?.revision).subscribe({
      next: (enregistre) => {
        this.enregistrement.set(false);
        this.article.set(enregistre);
        this.sourceEnregistree.set(enregistre.source);
        this.conflit.set(null);
        this.messages.add({ key: 'app', severity: 'success', summary: 'Article enregistré', detail: `Révision ${enregistre.revision}` });
        if (!a) this.router.navigate(['/admin/articles', enregistre.id], { replaceUrl: true });
      },
      error: (e) => {
        this.enregistrement.set(false);
        const err = lireErreur(e);
        // Sur un nouvel article, un 409 dit que l'adresse est prise, pas qu'un autre a
        // écrit pendant qu'on écrivait : le message de l'API le nomme.
        if (err.statusCode === 409 && err.revisionCourante && a) {
          this.conflit.set({ revision: err.revisionCourante, auteur: err.auteur ?? 'inconnu' });
        } else {
          this.refus.set({ titre: 'Enregistrement refusé', causes: err.causes ?? [String(err.message)] });
        }
      },
    });
  }

  publier(): void {
    const a = this.article();
    if (!a || this.modifie()) return;
    this.service.publier$(a.path).subscribe({
      next: () => {
        this.messages.add({
          key: 'app',
          severity: 'success',
          summary: a.publie > aujourdhuiAParis() ? 'Article programmé' : 'Article publié',
          detail: a.publie > aujourdhuiAParis() ? `Il paraîtra le ${dateLongue(a.publie)}.` : 'Il est en ligne.',
        });
        this.charger(a.id);
      },
      error: (e) => {
        const err = lireErreur(e);
        this.refus.set({ titre: 'Publication refusée', causes: err.causes ?? [String(err.message)] });
      },
    });
  }

  depublier(): void {
    const a = this.article();
    if (!a) return;
    this.confirmation.confirm({
      key: 'editeur',
      header: 'Repasser en brouillon ?',
      message: a.aParu
        ? `${a.path} ne sera plus servi : son adresse répondra 404 et sortira du plan du site. Elle reste réservée à cet article.`
        : `${a.path} ne paraîtra pas à sa date.`,
      acceptLabel: 'Repasser en brouillon',
      rejectLabel: 'Annuler',
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () =>
        this.service.depublier$(a.path).subscribe({
          next: () => this.charger(a.id),
          error: (e) => {
            const err = lireErreur(e);
            this.refus.set({
              titre: 'Dépublication refusée',
              causes: err.citants?.length ? [`Cité par : ${err.citants.join(', ')}. Retirer ces liens d'abord.`] : [String(err.message)],
            });
          },
        }),
    });
  }

  supprimer(): void {
    const a = this.article();
    if (!a) return;
    this.confirmation.confirm({
      key: 'editeur',
      header: 'Supprimer ce brouillon ?',
      message: `${a.path} et ses ${a.revision} révision(s) seront effacés. Il n'a jamais paru.`,
      acceptLabel: 'Supprimer',
      rejectLabel: 'Annuler',
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () =>
        this.service.supprimer$(a.id).subscribe({
          next: () => this.router.navigate(['/admin/articles']),
          error: (e) => this.refus.set({ titre: 'Suppression refusée', causes: [String(lireErreur(e).message)] }),
        }),
    });
  }

  // ── Historique et conflit ─────────────────────────────────────────────────

  ouvrirHistorique(): void {
    const a = this.article();
    if (!a) return;
    this.historiqueOuvert.set(true);
    this.service.revisions$(a.id).subscribe({ next: (r) => this.revisions.set(r) });
  }

  voirRevision(r: RevisionArticle): void {
    const a = this.article();
    if (!a) return;
    this.service.revision$(a.id, r.numero).subscribe({
      next: (v) => this.versionEnLigne.set({ titre: `Révision ${v.numero} — ${r.auteurNom}`, source: v.source, revision: v.numero }),
    });
  }

  restaurer(r: RevisionArticle): void {
    const a = this.article();
    if (!a) return;
    this.confirmation.confirm({
      key: 'editeur',
      header: `Restaurer la révision ${r.numero} ?`,
      message: this.modifie()
        ? `Vos modifications non enregistrées seront perdues. Le texte de la révision ${r.numero} devient une nouvelle révision ; rien n'est effacé.`
        : `Le texte de la révision ${r.numero} devient une nouvelle révision ; rien n'est effacé.`,
      acceptLabel: 'Restaurer',
      rejectLabel: 'Annuler',
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () =>
        this.service.restaurer$(a.id, r.numero).subscribe({
          next: (restaure) => {
            this.historiqueOuvert.set(false);
            this.versionEnLigne.set(null);
            this.messages.add({ key: 'app', severity: 'success', summary: 'Révision restaurée', detail: `Révision ${restaure.revision}` });
            this.charger(a.id);
          },
          error: (e) => this.refus.set({ titre: 'Restauration refusée', causes: lireErreur(e).causes ?? [String(lireErreur(e).message)] }),
        }),
    });
  }

  /** Conflit : la version qui a pris la place de celle qu'on éditait. */
  voirVersionEnLigne(): void {
    const a = this.article();
    if (!a) return;
    this.service.lire$(a.id).subscribe({
      next: (enLigne) =>
        this.versionEnLigne.set({ titre: `Version en ligne — révision ${enLigne.revision}, ${enLigne.majPar}`, source: enLigne.source, revision: enLigne.revision }),
    });
  }

  /** Abandonner son texte pour repartir de la version en ligne. */
  reprendreVersionEnLigne(): void {
    const a = this.article();
    if (!a) return;
    this.confirmation.confirm({
      key: 'editeur',
      header: 'Remplacer votre texte ?',
      message: 'Vos modifications non enregistrées seront perdues. Copiez-les d’abord si vous voulez les reporter.',
      acceptLabel: 'Remplacer',
      rejectLabel: 'Annuler',
      rejectButtonProps: { severity: 'secondary', text: true },
      accept: () => {
        this.versionEnLigne.set(null);
        this.charger(a.id);
      },
    });
  }

  quand(iso: string): string {
    const d = new Date(iso);
    return `${d.toLocaleDateString('fr-FR')} ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
  }
}
