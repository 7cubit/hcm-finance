import { Controller, Get, Post, Body, Query, UseGuards, Version } from '@nestjs/common';
import { RolloverService } from './rollover.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('rollover')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RolloverController {
  constructor(private readonly rolloverService: RolloverService) {}

  @Get('preview')
  @Version('1')
  @Roles('SUPER_ADMIN')
  async getPreview(@Query('year') year: string) {
    return this.rolloverService.getRolloverPreview(parseInt(year));
  }

  @Post('execute')
  @Version('1')
  @Roles('SUPER_ADMIN')
  async execute(@Body() data: { targetYear: number; carryOver: boolean; notifyStaff: boolean }) {
    return this.rolloverService.executeRollover(data.targetYear, {
      carryOver: data.carryOver,
      notifyStaff: data.notifyStaff
    });
  }
}
