import { Controller, Get, Query, UseGuards, Version, Res } from '@nestjs/common';
import { SearchService } from './search.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { Response } from 'express';

@Controller('search')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @Version('1')
  @Roles('SUPER_ADMIN', 'TREASURER', 'AUDITOR')
  async search(
    @Query('q') query: string,
    @Query('status') status?: string,
    @Query('departmentId') departmentId?: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    return this.searchService.globalSearch(query || '', {
      status: status as any,
      departmentId,
      includeDeleted: includeDeleted === 'true',
    });
  }

  @Get('export')
  @Version('1')
  @Roles('SUPER_ADMIN', 'TREASURER')
  async export(
    @Query('q') query: string,
    @Query('status') status: string,
    @Res() res: Response,
  ) {
    const csv = await this.searchService.exportToCsv(query, { status });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=search-results.csv');
    return res.send(csv);
  }
}
