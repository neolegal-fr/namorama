import { IsString, IsOptional, IsArray, ArrayMinSize, ArrayMaxSize, IsIn, IsUUID } from 'class-validator';

/**
 * Noms notés en une requête.
 *
 * Le plafond n'est pas décoratif : chaque identifiant fait une lecture en base
 * avec son contrôle de droits, et le lot part ensuite au modèle. Vingt couvre
 * largement une grille de résultats (dix noms), sans qu'un corps fabriqué à la
 * main puisse déclencher deux cents lectures et un pavé de tokens.
 */
export const ANALYZE_BATCH_MAX = 20;

export class AnalyzeNamesDto {
  /**
   * Forme historique, un seul nom. Conservée parce qu'un onglet resté ouvert
   * pendant un déploiement continue de l'envoyer : la retirer ferait échouer
   * l'analyse chez ceux qui n'ont pas rechargé, pour une économie nulle.
   */
  @IsOptional()
  @IsUUID()
  suggestionId?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(ANALYZE_BATCH_MAX, { message: `Maximum ${ANALYZE_BATCH_MAX} noms par requête` })
  @IsUUID(undefined, { each: true })
  suggestionIds?: string[];

  @IsOptional()
  @IsString()
  @IsIn(['cs','da','de','en','es','fi','fr','hu','it','ja','nl','no','pl','pt','ro','ru','sv','tr','zh'])
  lang?: string;
}
