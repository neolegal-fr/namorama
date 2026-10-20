import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModelUsageService, OperationModele } from '../model-usage/model-usage.service';
import { AnthropicAdaptateur } from './anthropic.adaptateur';
import { lireConfigurationIA } from './configuration';
import { Adaptateur, Demande, Fournisseur, ModelesParRole, Reponse, ReponseWeb } from './modele-ia.types';
import { OpenAiAdaptateur } from './openai.adaptateur';

/** Une bascule sur le secours se journalise au plus une fois par heure et par fournisseur. */
export const INTERVALLE_ALERTE_SECOURS_MS = 60 * 60 * 1000;

function adaptateur(f: Fournisseur, cle: string, modeles: ModelesParRole, usage?: ModelUsageService): Adaptateur {
  return f === 'anthropic'
    ? AnthropicAdaptateur.depuisCle(cle, modeles, usage)
    : OpenAiAdaptateur.depuisCle(cle, modeles, usage);
}

/**
 * Le seul point d'entrée vers un modèle. Les services disent ce qu'ils
 * demandent — rôle, consigne, format, budget, raisonnement — et le
 * fournisseur se choisit à la configuration (`AI_PROVIDER`).
 *
 * Le secours (`AI_FALLBACK_PROVIDER`) ne joue que sur un refus de crédit :
 * une limite de débit ou une surcharge se règle par les nouvelles tentatives
 * du SDK, et basculer dessus multiplierait les appels payants pendant une
 * simple saturation.
 */
@Injectable()
export class ModeleIA {
  private readonly logger = new Logger(ModeleIA.name);
  private readonly principal: Adaptateur;
  private readonly secours?: Adaptateur;
  private derniereAlerte = new Map<Fournisseur, number>();

  constructor(config: ConfigService, @Optional() usage?: ModelUsageService) {
    const c = lireConfigurationIA((k) => config.get<string>(k));
    this.principal = adaptateur(c.principal, c.cles[c.principal]!, c.modeles[c.principal]!, usage);
    if (c.secours) this.secours = adaptateur(c.secours, c.cles[c.secours]!, c.modeles[c.secours]!, usage);
    for (const a of c.avertissements) this.logger.warn(a);
    const m = this.principal.modeles;
    this.logger.log(
      `Modèle : ${c.principal} — simple: "${m.simple}" | créatif: "${m.creatif}" | analyse: "${m.analyse}"` +
        (this.secours ? ` · secours : ${this.secours.fournisseur}` : ''),
    );
  }

  /** Pour les tests, qui fournissent leurs propres adaptateurs. */
  static avec(principal: Adaptateur, secours?: Adaptateur): ModeleIA {
    const m = Object.create(ModeleIA.prototype) as ModeleIA;
    Object.assign(m, { logger: new Logger(ModeleIA.name), principal, secours, derniereAlerte: new Map() });
    return m;
  }

  get fournisseur(): Fournisseur {
    return this.principal.fournisseur;
  }

  async completer(operation: OperationModele, demande: Demande): Promise<Reponse> {
    return this.signaler(operation, await this.avecSecours(operation, (a) => a.completer(operation, demande)));
  }

  async chercherSurLeWeb(operation: OperationModele, demande: Omit<Demande, 'format'>): Promise<ReponseWeb> {
    return this.signaler(operation, await this.avecSecours(operation, (a) => a.chercherSurLeWeb(operation, demande)));
  }

  /**
   * Une réponse tronquée ou refusée arrive vide à l'opération, qui applique
   * son repli sans savoir pourquoi : c'est ici qu'on le dit. Un budget de
   * sortie trop juste se repère ainsi aux logs, pas à des résultats maigres.
   */
  private signaler<T extends Reponse>(operation: OperationModele, r: T): T {
    if (r.tronque || r.refuse) {
      this.logger.warn(`${operation} : réponse ${r.refuse ? 'refusée' : 'tronquée'} par ${r.fournisseur} (${r.modele}), repli de l'opération`);
    }
    return r;
  }

  private async avecSecours<T>(operation: OperationModele, appel: (a: Adaptateur) => Promise<T>): Promise<T> {
    try {
      return await appel(this.principal);
    } catch (erreur) {
      if (!this.secours || !this.principal.estCreditEpuise(erreur)) throw erreur;
      this.alerter(operation);
      return appel(this.secours);
    }
  }

  private alerter(operation: OperationModele): void {
    const f = this.principal.fournisseur;
    const maintenant = Date.now();
    if (maintenant - (this.derniereAlerte.get(f) ?? 0) < INTERVALLE_ALERTE_SECOURS_MS) return;
    this.derniereAlerte.set(f, maintenant);
    this.logger.warn(
      `ai_provider_fallback : crédits ${f} épuisés, appels servis par ${this.secours!.fournisseur} (première opération : ${operation})`,
    );
  }
}
