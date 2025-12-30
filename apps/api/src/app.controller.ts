import { Controller, Get, Version } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './common/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Version('1')
  @Public()
  getHello(): { message: string; version: string; timestamp: string } {
    return {
      message: this.appService.getHello(),
      version: 'v1',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('health')
  @Version('1')
  @Public()
  healthCheck(): { status: string; uptime: number } {
    return {
      status: 'healthy',
      uptime: process.uptime(),
    };
  }
}
