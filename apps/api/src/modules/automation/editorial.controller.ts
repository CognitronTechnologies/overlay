import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/current-user.decorator';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { Roles, RolesGuard } from '../../common/roles.guard';
import type { AuthUser } from '../../common/crypto';
import { EditorialEditDto, EditorialRejectDto } from './editorial.dto';
import { EditorialService } from './editorial.service';

@Controller('admin/editorial')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class EditorialController {
  constructor(private readonly editorial: EditorialService) {}

  @Get()
  list(
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('origin') origin?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.editorial.list({ type, status, origin, page, pageSize });
  }

  @Get(':type/:id')
  get(@Param('type') type: string, @Param('id') id: string) {
    return this.editorial.get(type, id);
  }

  @Patch(':type/:id')
  edit(@Param('type') type: string, @Param('id') id: string, @Body() dto: EditorialEditDto, @CurrentUser() actor: AuthUser) {
    return this.editorial.edit(type, id, dto, actor);
  }

  @Post(':type/:id/approve')
  approve(@Param('type') type: string, @Param('id') id: string, @CurrentUser() actor: AuthUser) {
    return this.editorial.approve(type, id, actor);
  }

  @Post(':type/:id/reject')
  reject(@Param('type') type: string, @Param('id') id: string, @Body() dto: EditorialRejectDto, @CurrentUser() actor: AuthUser) {
    return this.editorial.reject(type, id, dto.reason, actor);
  }
}
