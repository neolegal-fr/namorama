import { Controller, Get, Patch, Param, Body, Query, ParseIntPipe, DefaultValuePipe, Optional } from '@nestjs/common';
import { Roles } from 'nest-keycloak-connect';
import { AuthenticatedUser } from 'nest-keycloak-connect';
import { AdminService } from './admin.service';

class AdjustCreditsDto {
  delta: number;
  reason?: string;
}

@Controller('admin')
@Roles({ roles: ['realm:admin'] })
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

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
}
