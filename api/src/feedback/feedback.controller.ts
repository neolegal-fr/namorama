import { Controller, Post, Get, Body, HttpCode } from '@nestjs/common';
import { FeedbackService } from './feedback.service';
import { AuthenticatedUser, Roles } from 'nest-keycloak-connect';
import { IsString, MinLength, MaxLength, IsEmail, IsOptional } from 'class-validator';

class SubmitFeedbackDto {
  @IsString()
  @MinLength(20, { message: 'Le message doit faire au moins 20 caractères.' })
  @MaxLength(1000, { message: 'Le message ne peut pas dépasser 1 000 caractères.' })
  message: string;

  @IsOptional()
  @IsEmail({}, { message: 'Email invalide.' })
  email?: string;
}

@Controller('feedback')
export class FeedbackController {
  constructor(private feedbackService: FeedbackService) {}

  @Post()
  @HttpCode(200)
  async submit(
    @Body() dto: SubmitFeedbackDto,
    @AuthenticatedUser() keycloakUser: any,
  ) {
    await this.feedbackService.submit(keycloakUser.sub, dto.message, dto.email);
    return { ok: true };
  }

  @Get()
  @Roles({ roles: ['admin'] })
  async findAll() {
    return this.feedbackService.findAll();
  }
}
