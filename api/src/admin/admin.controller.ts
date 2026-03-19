import { Controller, Get, Patch, Post, Delete, Param, Body, Query, ParseIntPipe, DefaultValuePipe, HttpCode, ForbiddenException } from '@nestjs/common';
import { IsNumber, IsOptional, IsString } from 'class-validator';
import { Roles, AuthenticatedUser } from 'nest-keycloak-connect';
import { AdminService } from './admin.service';
import { FeedbackService } from '../feedback/feedback.service';
import { UsersService } from '../users/users.service';

class AdjustCreditsDto {
  @IsNumber()
  delta: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

@Controller('admin')
@Roles({ roles: ['realm:admin'] })
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly feedbackService: FeedbackService,
    private readonly usersService: UsersService,
  ) {}

  @Get('users')
  async getUsers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search = '',
  ) {
    return this.adminService.getUsers(page, limit, search);
  }

  @Patch('users/:id/credits')
  async adjustCredits(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: AdjustCreditsDto,
    @AuthenticatedUser() admin: any,
  ) {
    return this.adminService.adjustCredits(id, body.delta, body.reason ?? '', admin.sub);
  }

  @Delete('users/:id')
  @HttpCode(204)
  async deleteUser(
    @Param('id', ParseIntPipe) id: number,
    @AuthenticatedUser() admin: any,
  ) {
    const user = await this.usersService.findById(id);
    if (user?.keycloakId === admin.sub) {
      throw new ForbiddenException('You cannot delete your own account from the admin panel');
    }
    await this.usersService.deleteAccountById(id);
  }

  @Get('stats')
  async getStats(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.adminService.getStats(
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }

  @Get('feedback')
  async getFeedback() {
    return this.feedbackService.findAll();
  }

  @Post('feedback/:id/award-credits')
  async awardCredits(@Param('id') id: string) {
    return this.feedbackService.awardCredits(id);
  }

  @Post('feedback/:id/reject')
  async rejectFeedback(@Param('id') id: string) {
    return this.feedbackService.reject(id);
  }

  @Delete('feedback/:id')
  @HttpCode(204)
  async deleteFeedback(@Param('id') id: string) {
    await this.feedbackService.delete(id);
  }
}
