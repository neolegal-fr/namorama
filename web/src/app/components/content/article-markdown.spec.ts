import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { ArticleMarkdownComponent } from './article-markdown';
import type { ArticleMarkdown } from './articles';
import type { Lecture } from './articles-api';

/** Scénarios « Blocs réutilisables » et « Navigation interne sans rechargement ». */
describe('ArticleMarkdownComponent', () => {
  // Un article servi par l'API : un bloc, un lien interne et un lien externe.
  const article: ArticleMarkdown = {
    path: '/blog/essai',
    title: 'Essai',
    description: 'Description',
    titre: 'Essai',
    extrait: 'Extrait',
    categorie: 'Méthode',
    publie: '2026-11-23',
    misAJour: '2026-11-23',
    lecture: 4,
    h1: 'Trouver un nom d&#39;essai',
    segments: [
      { type: 'html', html: '<h2 id="methode">Méthode</h2>\n<p>Voir <a href="/guides/trouver-nom-de-marque#methode">le guide</a>.</p>\n' },
      { type: 'cta', label: 'Tester un nom' },
      { type: 'html', html: '<p><a href="https://www.inpi.fr/x" target="_blank" rel="noopener">INPI</a></p>\n' },
      { type: 'trois-risques' },
    ],
  };
  let donnees: BehaviorSubject<{ article: Lecture<ArticleMarkdown> }>;

  function monter(lecture: Lecture<ArticleMarkdown> = { etat: 'ok', valeur: article }) {
    donnees = new BehaviorSubject({ article: lecture });
    TestBed.configureTestingModule({
      imports: [ArticleMarkdownComponent],
      providers: [provideRouter([]), { provide: ActivatedRoute, useValue: { data: donnees.asObservable() } }],
    });
    const fixture = TestBed.createComponent(ArticleMarkdownComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('affiche titre, HTML et blocs dans l’ordre du texte', () => {
    const el: HTMLElement = monter().nativeElement;
    expect(el.querySelector('h1')?.textContent).toContain("Trouver un nom d'essai");
    const ordre = Array.from(el.querySelectorAll('article > .article-corps, article > app-article-cta, article > app-trois-risques')).map(
      (n) => (n.classList.contains('article-corps') ? 'html' : n.tagName.toLowerCase().replace('app-article-', '').replace('app-', '')),
    );
    expect(ordre).toEqual(article.segments.map((s) => s.type));
    // Les identifiants des titres survivent : ce sont les cibles des ancres.
    expect(el.querySelector('h2[id]')).not.toBeNull();
    // L'en-tête lit les dates de l'article servi, pas un registre compilé.
    expect(el.querySelector('.article-signature')?.textContent).toContain('4 min de lecture');
    expect(el.querySelector('app-article-cta')?.textContent).toContain('Tester un nom');
  });

  it('un clic simple sur un lien interne passe par le routeur', () => {
    const fixture = monter();
    const router = TestBed.inject(Router);
    const nav = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const lien = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>('.article-corps a[href^="/"]')!;
    const evt = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    lien.dispatchEvent(evt);
    expect(evt.defaultPrevented).toBe(true);
    expect(nav).toHaveBeenCalledWith(lien.getAttribute('href'));
  });

  it('Ctrl+clic et liens externes sont laissés au navigateur', () => {
    const fixture = monter();
    const nav = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const el = fixture.nativeElement as HTMLElement;
    const interne = el.querySelector<HTMLAnchorElement>('.article-corps a[href^="/"]')!;
    const ctrl = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ctrlKey: true });
    interne.dispatchEvent(ctrl);
    const externe = el.querySelector<HTMLAnchorElement>('.article-corps a[target="_blank"]')!;
    const simple = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    externe.addEventListener('click', (e) => e.defaultPrevented || e.preventDefault()); // pas d'ouverture réelle
    externe.dispatchEvent(simple);
    expect(ctrl.defaultPrevented).toBe(false);
    expect(nav).not.toHaveBeenCalled();
  });

  it('passe d’un article à l’autre sans recréer le composant (même route)', () => {
    const fixture = monter();
    donnees.next({ article: { etat: 'ok', valeur: { ...article, path: '/blog/autre', h1: 'Un autre article' } } });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('h1')?.textContent).toContain('Un autre article');
  });

  it('article absent : le dit, sans corps d’article', () => {
    const el: HTMLElement = monter({ etat: 'absent' }).nativeElement;
    expect(el.querySelector('h1')?.textContent).toContain('Article introuvable');
    expect(el.querySelector('article')).toBeNull();
  });

  it('source en panne : le dit, sans prétendre que l’article n’existe pas', () => {
    const el: HTMLElement = monter({ etat: 'indisponible' }).nativeElement;
    expect(el.querySelector('h1')?.textContent).toContain('momentanément indisponible');
  });
});
