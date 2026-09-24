import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Une visite, et jusqu'où elle est allée.
 *
 * Une ligne par session de navigateur (`sessionStorage`, éphémère, sans
 * cookie), créée au premier affichage d'une page et complétée au fil des
 * étapes franchies. C'est le seul endroit du produit qui connaisse le
 * DÉNOMINATEUR : sans elle, on sait combien de comptes ont été créés, jamais
 * sur combien de visiteurs.
 *
 * Trois raisons de ne pas s'en remettre aux sources existantes :
 *
 * - **Google Analytics** ne voit que ceux qui acceptent la bannière — c'est-à-dire
 *   pas ceux qui repartent tout de suite, précisément la population qu'on veut
 *   mesurer.
 * - **Les logs NDJSON** ne gardent que 30 jours, et aucun événement n'était
 *   émis au simple affichage d'une page : un visiteur qui lisait et repartait
 *   ne laissait aucune trace.
 * - **Les journaux nginx** de l'hôte tournent sur 14 jours et ne distinguaient
 *   pas les vhosts.
 *
 * Les colonnes sont des drapeaux, pas des compteurs : la question est « cette
 * visite a-t-elle lancé une recherche », pas « combien de fois ». Compter les
 * répétitions ferait dire au taux de conversion ce qu'il ne dit pas.
 */
@Entity('visitor_session')
export class VisitorSession {
  /** Identifiant de session anonyme, généré par le navigateur. Aucune personne derrière. */
  @PrimaryColumn({ type: 'varchar', length: 64 })
  sessionId: string;

  /** Instant du premier affichage. Rattache la visite à une journée, et à une période. */
  @Index()
  @Column({ type: 'datetime' })
  firstSeenAt: Date;

  /**
   * La visite a commencé avec une session déjà ouverte.
   *
   * Sans cette colonne, le taux « visiteurs → comptes créés » serait dilué par
   * ceux qui avaient déjà un compte et ne pouvaient donc pas en créer un : le
   * dénominateur de cette étape-là, ce sont les visites arrivées SANS compte.
   */
  @Column({ type: 'boolean', default: false })
  loggedInAtStart: boolean;

  /** A lancé au moins une recherche de domaines. */
  @Column({ type: 'boolean', default: false })
  searched: boolean;

  /** Un compte a été créé pendant cette visite (premier appel authentifié d'un `sub` inconnu). */
  @Column({ type: 'boolean', default: false })
  accountCreated: boolean;

  /** A demandé un rapport de marque complet — demande, pas rapport produit : un refus faute de crédits compte. */
  @Column({ type: 'boolean', default: false })
  reportRequested: boolean;

  /**
   * A ouvert le dialogue des packs de crédits — la seule « page tarifs » du
   * produit. Marqué depuis `POST /events` (`credits_dialog_opened`) : c'est
   * une balise du navigateur, donc une intention déclarée, pas une preuve.
   * Suffisant pour la question posée : l'offre est-elle seulement vue ?
   */
  @Column({ type: 'boolean', default: false })
  pricingViewed: boolean;

  /** A lancé un paiement Stripe (session Checkout créée côté serveur), abouti ou non. */
  @Column({ type: 'boolean', default: false })
  checkoutStarted: boolean;

  /**
   * Compte rattaché à la visite, dès qu'un appel authentifié la relie.
   *
   * Sert uniquement à ÉCARTER les visites des comptes admin et internes des
   * statistiques, comme partout ailleurs dans le tableau de bord. Une visite
   * jamais authentifiée reste comptée : c'est le cas normal d'un visiteur.
   */
  @Column({ type: 'varchar', length: 64, nullable: true })
  keycloakId: string | null;
}
