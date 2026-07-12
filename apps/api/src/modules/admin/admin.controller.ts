import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsIn } from 'class-validator';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { RolesGuard, Roles } from '../../common/roles.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import type { AuthUser } from '../../common/crypto';

class SetRoleDto {
  @IsIn(['user', 'tipster', 'admin'])
  role!: 'user' | 'tipster' | 'admin';
}

class SetTipsterStatusDto {
  @IsIn(['active', 'suspended'])
  status!: 'active' | 'suspended';
}

/** All admin routes require an authenticated admin principal. */
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('dashboard')
  dashboard() {
    return this.admin.dashboard();
  }

  @Get('users')
  users(@Query('take') take?: string, @Query('skip') skip?: string) {
    return this.admin.listUsers({
      take: take ? Number(take) : undefined,
      skip: skip ? Number(skip) : undefined,
    });
  }

  @Patch('users/:id/role')
  setRole(
    @Param('id') id: string,
    @Body() dto: SetRoleDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.admin.setUserRole(actor.userId, id, dto.role);
  }

  @Patch('tipsters/:id/status')
  setTipsterStatus(
    @Param('id') id: string,
    @Body() dto: SetTipsterStatusDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.admin.setTipsterStatus(actor.userId, id, dto.status);
  }

  @Get('audit-log')
  auditLog(
    @Query('entity') entity?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.admin.listAuditLog({
      entity,
      take: take ? Number(take) : undefined,
      skip: skip ? Number(skip) : undefined,
    });
  }
}
