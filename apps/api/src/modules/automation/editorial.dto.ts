import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class EditorialEditDto {
  @IsOptional() @IsString() @MinLength(3) @MaxLength(160) title?: string;
  @IsOptional() @IsString() @MaxLength(80) slug?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(50_000) body?: string;
  @IsOptional() @IsString() @MaxLength(300) excerpt?: string;
  @IsOptional() @IsIn(['content', 'news']) category?: 'content' | 'news';
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(40, { each: true }) tags?: string[];
  @IsOptional() @IsString() @MaxLength(60) sport?: string;
  @IsOptional() @IsString() @MaxLength(120) league?: string;
  @IsOptional() @IsString() @MaxLength(160) match?: string;
  @IsOptional() @IsString() @MaxLength(120) market?: string;
  @IsOptional() @IsString() @MaxLength(160) selection?: string;
  @IsOptional() @IsNumber() @Min(1.01) @Max(1000) odds?: number;
  @IsOptional() @IsString() @MaxLength(2000) analysis?: string;
  @IsOptional() @IsDateString() kickoffAt?: string;
  @IsOptional() @IsDateString() expiresAt?: string;
  @IsOptional() @IsObject() rationale?: Record<string, unknown>;
}

export class EditorialRejectDto {
  @IsString() @MinLength(1) @MaxLength(1000) reason!: string;
}

export const EDITORIAL_TYPES = ['article', 'free-tip'] as const;
export type EditorialType = (typeof EDITORIAL_TYPES)[number];
export const EDITORIAL_STATUSES = ['draft', 'pending', 'published', 'rejected', 'expired', 'archived'] as const;
