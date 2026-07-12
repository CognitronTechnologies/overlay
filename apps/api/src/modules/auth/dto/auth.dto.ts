import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsIn(['user', 'tipster'])
  role?: 'user' | 'tipster';
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}
