import { IsString, IsNotEmpty, IsOptional, MinLength, MaxLength, IsIn } from 'class-validator';

export class RefineDescriptionDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(5, { message: 'La description doit faire au moins 5 caractères' })
  @MaxLength(2000, { message: 'La description ne peut pas dépasser 2000 caractères' })
  description: string;

  @IsOptional()
  @IsIn(['cs','da','de','en','es','fi','fr','hu','it','ja','nl','no','pl','pt','ro','ru','sv','tr','zh'])
  locale?: string; // ex: 'fr', 'de', 'es' — null/absent = international
}
