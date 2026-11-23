import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { ArticleMarkdownComponent } from './article-markdown';
import { ARTICLES_MARKDOWN } from './articles.generes';

/** Scénarios « Blocs réutilisables » et « Navigation interne sans rechargement ». */
describe('ArticleMarkdownComponent', () => {
  // Un article qui a un bloc, un lien interne et un lien externe.
  const html = (a: (typeof ARTICLES_MARKDOWN)[number]) => a.segments.map((s) => (s.type === 'html' ? s.html : '')).join('');
  const article = ARTICLES_MARKDOWN.find(
    (a) => a.segments.some((s) => s.type === 'cta') && /href="\//.test(html(a)) && /target="_blank"/.test(html(a)),
  )!;

  function monter() {
    TestBed.configureTestingModule({
      imports: [ArticleMarkdownComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { data: { article: article.path } } } },
      ],
    });
    const fixture = TestBed.createComponent(ArticleMarkdownComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('affiche titre, HTML et blocs dans l’ordre du fichier', () => {
    const el: HTMLElement = monter().nativeElement;
    expect(el.querySelector('h1')?.textContent).toContain(article.h1.replace(/&#39;/g, "'").slice(0, 20));
    const ordre = Array.from(el.querySelectorAll('article > .article-corps, article > app-article-cta, article > app-trois-risques')).map(
      (n) => (n.classList.contains('article-corps') ? 'html' : n.tagName.toLowerCase().replace('app-article-', '').replace('app-', '')),
    );
    expect(ordre).toEqual(article.segments.map((s) => s.type));
    // Les identifiants des titres survivent : ce sont les cibles des ancres.
    expect(el.querySelector('h2[id]')).not.toBeNull();
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
});
