import { Type } from 'class-transformer';
import { TipRationaleDto } from '../../automation/automation.dto';
import {
  IsDateString,
  IsInt,
  IsObject,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
  MinLength,
} from 'class-validator';

export class CreateFreeTipDto {
  /** Optional legacy day; must match the kickoff UTC date. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date?: string;

  @IsString() @MinLength(1) @MaxLength(60) sport!: string;

  @IsOptional() @IsString() @MaxLength(120) league?: string;

  @IsString() @MinLength(1) @MaxLength(160) match!: string;

  @IsString() @MinLength(1) @MaxLength(120) market!: string;

  @IsString() @MinLength(1) @MaxLength(160) selection!: string;

  @IsOptional() @IsNumber() @Min(1, { message: 'odds must be greater than 1' }) odds?: number;

  @IsOptional() @IsString() @MaxLength(2000) analysis?: string;

  @IsOptional() @IsInt() sortOrder?: number;

  @IsDateString({ strict: true }) kickoffAt!: string;

  @IsOptional() @IsObject() @ValidateNested() @Type(() => TipRationaleDto)
  rationale?: TipRationaleDto;
}
