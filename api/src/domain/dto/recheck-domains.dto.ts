import { IsArray, IsString, ArrayMinSize, ArrayMaxSize, Matches } from 'class-validator';

export class RecheckDomainsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsString({ each: true })
  names: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @Matches(/^\.[a-z]{2,10}$/, { each: true, message: 'Format d\'extension invalide (ex: .com, .fr, .io)' })
  extensions: string[];
}
