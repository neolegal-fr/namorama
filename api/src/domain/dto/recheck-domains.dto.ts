import { IsArray, IsString, ArrayMinSize, ArrayMaxSize, Matches, MaxLength } from 'class-validator';

export class RecheckDomainsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(63, { each: true, message: 'Chaque nom de domaine ne peut pas dépasser 63 caractères' })
  @Matches(/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/, { each: true, message: 'Format de nom de domaine invalide' })
  names: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @Matches(/^\.[a-z]{2,10}$/, { each: true, message: 'Format d\'extension invalide (ex: .com, .fr, .io)' })
  extensions: string[];
}
