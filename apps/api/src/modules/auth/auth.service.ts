import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma.service';
import { hashPassword, verifyPassword, type AuthUser } from '../../common/crypto';
import { RegisterDto, LoginDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  /** Register a user (and a Tipster profile when role === 'tipster'). */
  async register(dto: RegisterDto): Promise<{ token: string }> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('Email already registered');

    const role = dto.role ?? 'user';
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash: hashPassword(dto.password),
          role,
        },
      });
      if (role === 'tipster') {
        await tx.tipster.create({ data: { userId: created.id } });
      }
      return created;
    });

    return { token: this.sign(user.id, role, role === 'tipster' ? user.id : undefined) };
  }

  /** Validate credentials and issue a JWT. */
  async login(dto: LoginDto): Promise<{ token: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user || !verifyPassword(dto.password, user.passwordHash)) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const tipsterId = user.role === 'tipster' ? user.id : undefined;
    return { token: this.sign(user.id, user.role, tipsterId) };
  }

  private sign(
    userId: string,
    role: AuthUser['role'],
    tipsterId?: string,
  ): string {
    return this.jwt.sign({ sub: userId, role, tipsterId });
  }
}
