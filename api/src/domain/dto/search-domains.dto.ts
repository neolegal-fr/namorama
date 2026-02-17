import { IsString, IsNotEmpty, IsArray, IsEnum, IsOptional } from 'class-validator';

export enum MatchMode {
  ANY = 'any',
  ALL = 'all'
}

export class SearchDomainsDto {
  @IsString()
  @IsNotEmpty()
  description: string;

  @IsArray()
  @IsString({ each: true })
  keywords: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  extensions?: string[];

  @IsEnum(MatchMode)
  @IsOptional()
  matchMode?: MatchMode;

  @IsString()
  @IsOptional()
  projectId?: string;

  @IsString()
  @IsOptional()
  projectName?: string;
}
