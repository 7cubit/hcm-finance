import { Controller, Get, Post, Body, Param, UseGuards, Version } from '@nestjs/common';
import { EditRequestService } from './edit-request.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('unlock-requests')
export class EditRequestController {
  constructor(private readonly editRequestService: EditRequestService) {}

  @Post('submit')
  @Version('1')
  @Public()
  async submit(@Body() data: { departmentId: string; month: string; year: number; reason: string; email: string }) {
    return this.editRequestService.submitRequest(data);
  }

  @Get('pending')
  @Version('1')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'TREASURER')
  async getPending() {
    return this.editRequestService.findAllPending();
  }

  @Post(':id/approve')
  @Version('1')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'TREASURER')
  async approve(@Param('id') id: string, @CurrentUser() admin: any) {
    return this.editRequestService.approveRequest(id, admin.email);
  }
}
