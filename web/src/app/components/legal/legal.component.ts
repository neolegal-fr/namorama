import { Component, OnInit, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-legal',
  standalone: true,
  imports: [RouterModule],
  template: `
    <div class="max-w-3xl mx-auto px-4 py-12 text-900">
      @if (lang() === 'fr') {
        <h1 class="text-3xl font-bold mb-8">Mentions légales</h1>

        <h2 class="text-xl font-semibold mt-8 mb-3">Éditeur du site</h2>
        <p>
          <strong>NEOLEGAL</strong><br>
          Société par actions simplifiée (SAS) au capital de 1 000 €<br>
          SIREN : 911 289 502<br>
          SIRET : 911 289 502 00013<br>
          RCS Tarascon n° 911 289 502<br>
          N° TVA intracommunautaire : FR51911289502<br>
          Siège social : 2758 VC Ancien Chemin d'Arles, 13210 Saint-Rémy-de-Provence, France<br>
          Email : <a href="mailto:support@namorama.com" class="text-primary">support&#64;namorama.com</a>
        </p>

        <h2 class="text-xl font-semibold mt-8 mb-3">Directeur de la publication</h2>
        <p>Nicolas RIOUSSET, Président de NEOLEGAL</p>

        <h2 class="text-xl font-semibold mt-8 mb-3">Hébergeur</h2>
        <p>
          <strong>OVH SAS</strong><br>
          2 rue Kellermann, 59100 Roubaix, France<br>
          RCS Lille Métropole 424 761 419 00045<br>
          <a href="https://www.ovhcloud.com" target="_blank" rel="noopener" class="text-primary">www.ovhcloud.com</a>
        </p>

        <h2 class="text-xl font-semibold mt-8 mb-3">Propriété intellectuelle</h2>
        <p>
          L'ensemble des contenus présents sur le site namorama.com (textes, images, graphismes, logo, icônes, sons, logiciels) est la propriété exclusive de NEOLEGAL ou de ses partenaires. Toute reproduction, distribution, modification, adaptation, retransmission ou publication de ces éléments est strictement interdite sans l'accord écrit préalable de NEOLEGAL.
        </p>

        <h2 class="text-xl font-semibold mt-8 mb-3">Limitation de responsabilité</h2>
        <p>
          NEOLEGAL ne peut être tenu responsable des dommages directs ou indirects résultant de l'accès ou de l'utilisation du site, ni des informations qui y sont présentées. Les disponibilités de noms de domaine affichées sont fournies à titre indicatif et peuvent évoluer à tout moment.
        </p>

        <h2 class="text-xl font-semibold mt-8 mb-3">Droit applicable</h2>
        <p>
          Les présentes mentions légales sont soumises au droit français. En cas de litige, et après tentative de résolution amiable, les tribunaux français seront seuls compétents.
        </p>

        <div class="mt-10">
          <a routerLink="/" class="text-primary text-sm">← Retour à l'accueil</a>
        </div>
      } @else {
        <h1 class="text-3xl font-bold mb-8">Legal Notice</h1>

        <h2 class="text-xl font-semibold mt-8 mb-3">Publisher</h2>
        <p>
          <strong>NEOLEGAL</strong><br>
          Simplified joint-stock company (SAS) with share capital of €1,000<br>
          SIREN: 911 289 502<br>
          SIRET: 911 289 502 00013<br>
          RCS Tarascon no. 911 289 502<br>
          VAT number: FR51911289502<br>
          Registered office: 2758 VC Ancien Chemin d'Arles, 13210 Saint-Rémy-de-Provence, France<br>
          Email: <a href="mailto:support@namorama.com" class="text-primary">support&#64;namorama.com</a>
        </p>

        <h2 class="text-xl font-semibold mt-8 mb-3">Publication Director</h2>
        <p>Nicolas RIOUSSET, President of NEOLEGAL</p>

        <h2 class="text-xl font-semibold mt-8 mb-3">Hosting Provider</h2>
        <p>
          <strong>OVH SAS</strong><br>
          2 rue Kellermann, 59100 Roubaix, France<br>
          RCS Lille Métropole 424 761 419 00045<br>
          <a href="https://www.ovhcloud.com" target="_blank" rel="noopener" class="text-primary">www.ovhcloud.com</a>
        </p>

        <h2 class="text-xl font-semibold mt-8 mb-3">Intellectual Property</h2>
        <p>
          All content on namorama.com (texts, images, graphics, logo, icons, sounds, software) is the exclusive property of NEOLEGAL or its partners. Any reproduction, distribution, modification, adaptation, retransmission or publication of these elements is strictly prohibited without the prior written consent of NEOLEGAL.
        </p>

        <h2 class="text-xl font-semibold mt-8 mb-3">Limitation of Liability</h2>
        <p>
          NEOLEGAL cannot be held liable for direct or indirect damages resulting from access to or use of the site, or from the information presented therein. Domain name availability results are provided for informational purposes only and may change at any time.
        </p>

        <h2 class="text-xl font-semibold mt-8 mb-3">Governing Law</h2>
        <p>
          These legal notices are governed by French law. In the event of a dispute, and after an attempt at amicable resolution, the French courts shall have sole jurisdiction.
        </p>

        <div class="mt-10">
          <a routerLink="/" class="text-primary text-sm">← Back to home</a>
        </div>
      }
    </div>
  `,
})
export class LegalComponent implements OnInit {
  lang = signal('fr');

  constructor(private translate: TranslateService) {}

  ngOnInit() {
    this.lang.set(this.translate.currentLang?.startsWith('fr') ? 'fr' : 'en');
    this.translate.onLangChange.subscribe(e => {
      this.lang.set(e.lang?.startsWith('fr') ? 'fr' : 'en');
    });
  }
}
