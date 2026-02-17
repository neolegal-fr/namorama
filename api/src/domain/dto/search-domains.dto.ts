import { IsString, IsNotEmpty, IsArray } from 'class-validator';

export class SearchDomainsDto {
  @IsString()
  @IsNotEmpty()
  description: string;

  @IsArray()
  @IsString({ each: true })
  keywords: string[];
}
