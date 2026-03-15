import { Controller, Post, Body, HttpCode, Req } from '@nestjs/common';
import { FeedbackService } from './feedback.service';
import { Public } from 'nest-keycloak-connect';
import { IsString, MinLength, MaxLength, IsEmail, IsOptional } from 'class-validator';

class SubmitFeedbackDto {
  @IsString()
  @MinLength(10, { message: 'Le message doit faire au moins 10 caractères.' })
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
  @Public()
  @HttpCode(200)
  async submit(
    @Body() dto: SubmitFeedbackDto,
    @Req() req: any,
  ) {
    // @Public() bypasses the auth guard; extract sub manually if a Bearer token is present.
    let keycloakId: string | null = null;
    const auth: string | undefined = req.headers?.authorization;
    if (auth?.startsWith('Bearer ')) {
      try {
        const payload = JSON.parse(Buffer.from(auth.split('.')[1], 'base64').toString('utf8'));
        keycloakId = payload?.sub ?? null;
      } catch { /* anonymous — no token or malformed */ }
    }

    const result = await this.feedbackService.submit(keycloakId, dto.message, dto.email);
    return { ok: true, creditsAwarded: result.creditsAwarded };
  }
}
