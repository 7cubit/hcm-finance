import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Version } from '@nestjs/common';
import { DepartmentService } from './department.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('departments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  @Get()
  @Version('1')
  @Roles('SUPER_ADMIN', 'TREASURER', 'AUDITOR')
  async findAll() {
    return this.departmentService.findAll();
  }

  @Get(':id')
  @Version('1')
  @Roles('SUPER_ADMIN', 'TREASURER', 'AUDITOR')
  async findOne(@Param('id') id: string) {
    return this.departmentService.findOne(id);
  }

  @Post()
  @Version('1')
  @Roles('SUPER_ADMIN')
  async create(@Body() data: { name: string; budgetLimit: number; headEmail: string }) {
    return this.departmentService.create(data);
  }

  @Patch(':id/budget')
  @Version('1')
  @Roles('SUPER_ADMIN', 'TREASURER')
  async updateBudget(@Param('id') id: string, @Body('budgetLimit') budgetLimit: number) {
    return this.departmentService.updateBudget(id, budgetLimit);
  }

  @Post(':id/regenerate-sheet')
  @Version('1')
  @Roles('SUPER_ADMIN')
  async regenerateSheet(@Param('id') id: string) {
    return this.departmentService.regenerateSheet(id);
  }

  @Post('sheets/:sheetId/access')
  @Version('1')
  @Roles('SUPER_ADMIN', 'TREASURER')
  async addAccess(
    @Param('sheetId') sheetId: string,
    @Body() data: { email: string; role: 'EDITOR' | 'VIEWER' }
  ) {
    return this.departmentService.addSheetUser(sheetId, data.email, data.role);
  }

  @Delete('sheets/:sheetId/access/:userId')
  @Version('1')
  @Roles('SUPER_ADMIN', 'TREASURER')
  async removeAccess(
    @Param('sheetId') sheetId: string,
    @Param('userId') userId: string
  ) {
    return this.departmentService.removeSheetUser(sheetId, userId);
  }
}
