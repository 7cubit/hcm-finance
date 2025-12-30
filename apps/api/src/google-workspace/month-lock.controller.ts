import { Controller, Post, Param, UseGuards, Version } from '@nestjs/common';
import { MonthLockService } from './month-lock.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('google-workspace/locks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MonthLockController {
  constructor(private readonly lockService: MonthLockService) {}

  @Post(':id/lock/:month')
  @Version('1')
  @Roles('SUPER_ADMIN', 'TREASURER')
  async lock(@Param('id') id: string, @Param('month') month: string) {
    await this.lockService.lockMonth(id, month);
    return { message: `${month} locked successfully` };
  }

  @Post(':id/unlock/:month')
  @Version('1')
  @Roles('SUPER_ADMIN', 'TREASURER')
  async unlock(@Param('id') id: string, @Param('month') month: string) {
    await this.lockService.unlockMonth(id, month);
    return { message: `${month} unlocked successfully` };
  }
}
