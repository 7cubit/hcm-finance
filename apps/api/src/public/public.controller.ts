import { Controller, Get, Version } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';

@Controller('public')
export class PublicController {
  // Public church info - no auth required
  @Get('info')
  @Version('1')
  @Public()
  getChurchInfo() {
    return {
      name: 'HCMJ Church',
      location: 'Tokyo, Japan',
      currency: 'JPY',
      contactEmail: 'info@hcmj.church',
    };
  }

  // Public giving categories - for donation forms
  @Get('giving-categories')
  @Version('1')
  @Public()
  getGivingCategories() {
    return {
      categories: [
        { id: 'tithe', name: 'Tithe', description: 'Regular tithe giving' },
        { id: 'offering', name: 'Offering', description: 'General offering' },
        { id: 'missions', name: 'Missions', description: 'Support missionaries' },
        { id: 'building', name: 'Building Fund', description: 'Church construction' },
      ],
    };
  }

  // Health check
  @Get('health')
  @Version('1')
  @Public()
  healthCheck() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    };
  }
}
