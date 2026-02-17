import { IsString, IsNotEmpty } from 'class-validator';

export class RefineDescriptionDto {
  @IsString()
  @IsNotEmpty()
  description: string;
}
