import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, RefreshTokenDto } from './dto/auth.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Throttle } from '@nestjs/throttler';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // Public: Login endpoint with rate limiting
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // Public: Refresh token
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute
  async refresh(@Body() dto: RefreshTokenDto) {
    const tokens = await this.authService.refreshTokens(dto.refreshToken);
    return tokens;
  }

  // Protected: Get current user profile and permissions
  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getMe(@CurrentUser('id') userId: string) {
    return this.authService.getCurrentUser(userId);
  }

  // Admin only: Register new user
  @Post('register')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'TREASURER')
  async register(
    @Body() dto: RegisterDto,
    @CurrentUser('role') creatorRole: string,
  ) {
    return this.authService.register(dto, creatorRole as any);
  }

  // Logout (client-side token removal, server records logout)
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser('id') userId: string) {
    // In a production app, you'd invalidate the refresh token here
    return { message: 'Logged out successfully' };
  }
}
