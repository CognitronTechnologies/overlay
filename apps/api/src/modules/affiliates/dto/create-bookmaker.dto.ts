import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

export class CreateBookmakerDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsString()
  @MaxLength(120)
  slug!: string;

  @IsOptional()
  @IsString()
  logo?: string;

  @IsUrl()
  website!: string;

  @IsOptional()
  @IsUrl()
  destinationUrl?: string;

  @IsOptional()
  @IsString()
  trackingParams?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  promoCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  promoCodeDescription?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  welcomeOffer?: string;

  @IsOptional()
  @IsString()
  termsSummary?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsArray()
  @IsString({ each: true })
  supportedCountries!: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}