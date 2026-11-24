import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/** Un article dépasse rarement 15 ko ; 200 000 caractères laissent une large marge. */
const SOURCE_MAX = 200_000;

export class SourceDto {
  @IsString()
  @MaxLength(SOURCE_MAX)
  source: string;
}

export class VerifierDto extends SourceDto {
  /** Article modifié (écran) : son chemin actuel ne compte pas comme « pris ». */
  @IsOptional()
  @IsInt()
  id?: number;

  /** Vérifier comme à la publication (liens vers des articles parus seulement). */
  @IsOptional()
  @IsBoolean()
  publier?: boolean;
}

export class EnregistrerDto extends SourceDto {
  @IsOptional()
  @IsInt()
  id?: number;

  /** Révision sur laquelle le texte a été écrit ; obligatoire pour une modification. */
  @IsOptional()
  @IsInt()
  @Min(1)
  revisionAttendue?: number;

  @IsOptional()
  @IsBoolean()
  publier?: boolean;
}

export class LotDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @MaxLength(SOURCE_MAX, { each: true })
  sources: string[];

  @IsOptional()
  @IsBoolean()
  publier?: boolean;
}

export class CheminsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  paths: string[];
}

export class CheminDto {
  @IsString()
  @MaxLength(200)
  path: string;
}

export class NomDeJetonDto {
  @IsString()
  @MaxLength(80)
  nom: string;
}
