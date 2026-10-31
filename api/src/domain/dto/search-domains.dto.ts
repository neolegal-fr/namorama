import { IsString, IsNotEmpty, IsArray, IsEnum, IsOptional, IsBoolean, IsInt, Min, Max, MinLength, MaxLength, ArrayMinSize, ArrayMaxSize, Matches, IsIn } from 'class-validator';
import {
  DESCRIPTION_MIN_LENGTH,
  DESCRIPTION_MAX_LENGTH,
  DESCRIPTION_MIN_MESSAGE,
  DESCRIPTION_MAX_MESSAGE,
} from './description.constants';

export enum MatchMode {
  ANY = 'any',
  ALL = 'all'
}

export class SearchDomainsDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(DESCRIPTION_MIN_LENGTH, { message: DESCRIPTION_MIN_MESSAGE })
  @MaxLength(DESCRIPTION_MAX_LENGTH, { message: DESCRIPTION_MAX_MESSAGE })
  description: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Au moins un mot-clé est requis' })
  @ArrayMaxSize(50, { message: 'Maximum 50 mots-clés autorisés' })
  @IsString({ each: true })
  @MaxLength(100, { each: true, message: 'Chaque mot-clé ne peut pas dépasser 100 caractères' })
  keywords: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @Matches(/^\.[a-z]{2,10}$/, { each: true, message: 'Format d\'extension invalide (ex: .com, .fr, .io)' })
  @IsOptional()
  extensions?: string[];

  @IsEnum(MatchMode)
  @IsOptional()
  matchMode?: MatchMode;

  @IsString()
  @IsOptional()
  projectId?: string;

  @IsString()
  @MaxLength(100)
  @IsOptional()
  projectName?: string;

  @IsOptional()
  @IsIn(['cs','da','de','en','es','fi','fr','hu','it','ja','nl','no','pl','pt','ro','ru','sv','tr','zh'])
  locale?: string;

  /** Noms déjà vérifiés dans le projet : le front envoie les 2 000 plus récents. */
  @IsArray()
  @ArrayMaxSize(2000)
  @IsString({ each: true })
  @IsOptional()
  excludeNames?: string[];

  @IsBoolean()
  @IsOptional()
  descriptiveNames?: boolean;

  @IsBoolean()
  @IsOptional()
  culturalNames?: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  likedNames?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  dislikedNames?: string[];

  /**
   * Longueur minimale. L'écran ne l'envoie plus : seul un onglet ouvert avant
   * le chantier `refondre-l-ecran-de-cadrage` le fait encore. Acceptée dès 5
   * pour ne pas lui renvoyer un 400, puis relevée au plancher de 6.
   */
  @IsInt()
  @Min(5)
  @Max(12)
  @IsOptional()
  minLength?: number;

  /**
   * Longueur maximale (« au plus N caractères »), envoyée seulement si
   * l'utilisateur l'a réglée ; « sans limite » envoie 30. Absente, la borne
   * vient du brief, ou du défaut. Jamais sous le plancher de 6.
   */
  @IsInt()
  @Min(6)
  @Max(30)
  @IsOptional()
  maxLength?: number;

  /**
   * Contraintes du brief que l'utilisateur a retirées à l'étape 2 :
   * `longueur`, `fin:<terminaison>`, `eviter:<mot>`, `avec:<mot>`.
   */
  @IsArray()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  @Matches(/^(longueur|(fin|eviter|avec):[a-z0-9 '-]{1,30})$/i, { each: true, message: 'Contrainte retirée invalide' })
  @IsOptional()
  contraintesRetirees?: string[];

  /** Exemples de noms/domaines que l'utilisateur aime — servent de références de style. */
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  @IsOptional()
  likedExamples?: string[];

  /** Domaines de produits existants du même secteur, à ne pas imiter de trop près. */
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  @IsOptional()
  competitorDomains?: string[];

  /** Domaines dont l'utilisateur a explicitement rejeté le style. */
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  @IsOptional()
  dislikedStyleDomains?: string[];
}
