import { IsString, IsNotEmpty, IsArray, IsEnum, IsOptional, IsBoolean, MinLength, MaxLength, ArrayMinSize, ArrayMaxSize, Matches, IsIn } from 'class-validator';

export enum MatchMode {
  ANY = 'any',
  ALL = 'all'
}

export class SearchDomainsDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(10, { message: 'La description doit faire au moins 10 caractères' })
  @MaxLength(2000, { message: 'La description ne peut pas dépasser 2000 caractères' })
  description: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Au moins un mot-clé est requis' })
  @ArrayMaxSize(50, { message: 'Maximum 50 mots-clés autorisés' })
  @IsString({ each: true })
  @MaxLength(100, { each: true, message: 'Chaque mot-clé ne peut pas dépasser 100 caractères' })
  @Matches(/^[\p{L}\p{N}\s\-]{1,100}$/u, { each: true, message: 'Les mots-clés ne peuvent contenir que des lettres, chiffres, espaces et tirets' })
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

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  excludeNames?: string[];

  @IsBoolean()
  @IsOptional()
  descriptiveNames?: boolean;

  @IsBoolean()
  @IsOptional()
  culturalNames?: boolean;
}
