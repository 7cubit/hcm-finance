import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaClient, UserRole } from '@prisma/client';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { JwtPayload } from './strategies/jwt.strategy';

const prisma = new PrismaClient();

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  // Hash password with Argon2
  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
  }

  // Verify password
  async verifyPassword(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  // Generate tokens
  generateTokens(user: AuthUser): TokenResponse {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    // Access token - 15 minutes (Phase 17: Security Hardening)
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: '15m',
    });

    // Refresh token - 7 days
    const refreshToken = this.jwtService.sign(
      { sub: user.id, type: 'refresh' },
      { expiresIn: '7d' },
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
    };
  }

  // Login
  async login(dto: LoginDto): Promise<{ user: AuthUser; tokens: TokenResponse }> {
    const user = await prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValidPassword = await this.verifyPassword(user.password, dto.password);

    if (!isValidPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = this.generateTokens({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      tokens,
    };
  }

  // Refresh tokens
  async refreshTokens(refreshToken: string): Promise<TokenResponse> {
    try {
      const payload = this.jwtService.verify(refreshToken);

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('User not found or inactive');
      }

      return this.generateTokens({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  // Get current user
  async getCurrentUser(userId: string): Promise<AuthUser & { permissions: string[] }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Define permissions based on role
    const rolePermissions: Record<UserRole, string[]> = {
      SUPER_ADMIN: ['*'], // Full access
      TREASURER: [
        'transactions:read',
        'transactions:write',
        'transactions:approve',
        'funds:read',
        'donors:read',
        'donors:write',
        'reports:read',
      ],
      AUDITOR: [
        'transactions:read',
        'funds:read',
        'donors:read',
        'reports:read',
        'audit:read',
      ],
      STAFF: [
        'transactions:read',
        'transactions:write',
        'funds:read',
        'donors:read',
      ],
      VIEWER: ['dashboard:read', 'reports:read'],
    };

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      permissions: rolePermissions[user.role] || [],
    };
  }

  // Register new user (admin only)
  async register(dto: RegisterDto, creatorRole?: UserRole): Promise<AuthUser> {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const hashedPassword = await this.hashPassword(dto.password);

    const user = await prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        name: dto.name,
        role: 'VIEWER', // Default role
      },
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }
}
