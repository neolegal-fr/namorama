import { Routes } from '@angular/router';
import { LandingComponent } from './components/landing/landing';
import { WizardComponent } from './components/wizard/wizard';
import { PaymentResultComponent } from './components/payment-result/payment-result';
import { RetourComponent } from './components/retour/retour';
import { AdminComponent } from './components/admin/admin.component';
import { AdminDashboardComponent } from './components/admin/admin-dashboard.component';
import { AdminUsersComponent } from './components/admin/admin-users.component';
import { AdminFeedbackComponent } from './components/admin/admin-feedback.component';
import { AdminModelPricesComponent } from './components/admin/admin-model-prices.component';
import { AdminCostsComponent } from './components/admin/admin-costs.component';
import { AdminReplaysComponent } from './components/admin/admin-replays.component';
import { AdminArticlesComponent } from './components/admin/admin-articles.component';
import { AdminArticleEditeurComponent } from './components/admin/admin-article-editeur.component';
import { LegalComponent } from './components/legal/legal.component';
import { PrivacyComponent } from './components/privacy/privacy.component';
import { BlogIndexComponent } from './components/content/blog-index';
import { VerifierDisponibiliteMarqueComponent } from './components/content/verifier-disponibilite-nom-de-marque';
import { ArticleMarkdownComponent } from './components/content/article-markdown';
import { CHEMINS_HISTORIQUES } from './components/content/chemins-historiques';
import { resoudreArticle, resoudreParus } from './components/content/articles-api';
import { RapportPartageComponent } from './components/content/rapport-partage';
import { RapportPublicComponent } from './components/content/rapport-public';
import { adminGuard } from './guards/admin.guard';

export const routes: Routes = [
  { path: '', component: LandingComponent },
  // Accueil en anglais : même composant, langue tirée de l'URL. Seule page à
  // avoir une version anglaise réelle — les guides restent en français et
  // n'ont donc pas de `/en/` (ce serait du contenu dupliqué).
  { path: 'en', component: LandingComponent },
  // L'index s'appelle « blog » depuis le 23/11/2026. nginx répond déjà 301 sur
  // /guides ; cette redirection ne sert qu'à la navigation interne au client.
  { path: 'guides', redirectTo: 'blog', pathMatch: 'full' },
  // Blog : articles en base, lus dans l'API par un résolveur et rendus par le serveur
  // à la demande (chantier `articles-en-base`). Un nouvel article vit sous
  // `/blog/<identifiant>` ; les adresses antérieures au blog sont figées.
  { path: 'blog', component: BlogIndexComponent, resolve: { articles: resoudreParus } },
  { path: 'blog/:slug', component: ArticleMarkdownComponent, resolve: { article: resoudreArticle } },
  ...CHEMINS_HISTORIQUES.map((p) => ({
    path: p.slice(1),
    component: ArticleMarkdownComponent,
    resolve: { article: resoudreArticle },
  })),
  { path: 'verifier-disponibilite-nom-de-marque', component: VerifierDisponibiliteMarqueComponent },
  { path: 'rapport/:token', component: RapportPartageComponent },
  /*
   * Rapport PUBLIC d'un nom, sans compte : `/report?name=…`.
   *
   * Distinct de `/rapport/:token`, qui rejoue un rapport ACHETÉ partagé par
   * son propriétaire. Ici rien n'a été acheté : seuls les domaines sont
   * contrôlés, gratuitement, et le reste s'annonce derrière l'inscription.
   */
  { path: 'report', component: RapportPublicComponent },
  { path: 'app', component: WizardComponent },
  { path: 'projects/:id', component: WizardComponent },
  { path: 'payment/success', component: PaymentResultComponent },
  { path: 'payment/cancel', component: PaymentResultComponent },
  // Liens de la demande de retour : rendus côté client, car c'est la page
  // exécutée qui enregistre la réponse, pas le chargement du lien.
  { path: 'retour', component: RetourComponent },
  { path: 'desinscription', component: RetourComponent },
  {
    path: 'admin',
    component: AdminComponent,
    canActivate: [adminGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: AdminDashboardComponent },
      { path: 'users', component: AdminUsersComponent },
      { path: 'feedback', component: AdminFeedbackComponent },
      { path: 'costs', component: AdminCostsComponent },
      { path: 'prices', component: AdminModelPricesComponent },
      { path: 'replays', component: AdminReplaysComponent },
      // Articles du blog en base : rédaction sans déploiement (articles-en-base).
      { path: 'articles', component: AdminArticlesComponent },
      { path: 'articles/:id', component: AdminArticleEditeurComponent },
    ],
  },
  { path: 'legal', component: LegalComponent },
  { path: 'privacy', component: PrivacyComponent },
  { path: '**', redirectTo: '' }
];
