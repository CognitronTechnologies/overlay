import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ContentSourceDto {
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true }) @MaxLength(2048) url!: string;
  @IsString() @MinLength(1) @MaxLength(300) title!: string;
  @IsString() @MinLength(1) @MaxLength(120) publisher!: string;
  @IsDateString() retrievedAt!: string;
  @IsIn(['news', 'official', 'match', 'odds', 'other']) kind!: 'news' | 'official' | 'match' | 'odds' | 'other';
}

class SourcesDto {
  @IsOptional() @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => ContentSourceDto)
  sources?: ContentSourceDto[];
}

export class ArticleDraftDto extends SourcesDto {
  @IsString() @MinLength(3) @MaxLength(160) title!: string;
  @IsOptional() @IsString() @MaxLength(80) slug?: string;
  @IsString() @MinLength(1) @MaxLength(50_000) body!: string;
  @IsOptional() @IsString() @MaxLength(300) excerpt?: string;
  @IsOptional() @IsIn(['news', 'content']) category?: 'news' | 'content';
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(40, { each: true }) tags?: string[];
  @IsString() @MinLength(8) @MaxLength(160) dedupeKey!: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(300, { each: true }) reviewerWarnings?: string[];
  @IsOptional() @IsString() @MaxLength(80) automationRunId?: string;
}

export class TipRationaleDto {
  @IsString() @MinLength(1) @MaxLength(4000) rationale!: string;
  @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) @MaxLength(1000, { each: true }) counterarguments!: string[];
}

export class FreeTipDraftDto {
  @IsString() @MinLength(1) @MaxLength(60) sport!: string;
  @IsString() @MinLength(1) @MaxLength(120) league!: string;
  @IsString() @MinLength(1) @MaxLength(160) match!: string;
  @IsString() @MaxLength(40) market!: string;
  @IsString() @MinLength(1) @MaxLength(160) selection!: string;
  @IsNumber({ allowNaN: false, allowInfinity: false }) odds!: number;
  @IsString() @MinLength(1) @MaxLength(2000) analysis!: string;
  @IsString() @MinLength(8) @MaxLength(160) dedupeKey!: string;
  @IsDateString() tipDate!: string;
  @IsDateString() kickoffAt!: string;
  @IsOptional() @IsDateString() expiresAt?: string;
  @IsOptional() @IsString() @MaxLength(80) eventId?: string;
  @IsOptional() @IsString() @MaxLength(120) oddsProvider?: string;
  @IsOptional() @IsDateString() oddsRetrievedAt?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => ContentSourceDto)
  sources?: ContentSourceDto[];
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(300, { each: true }) reviewerWarnings?: string[];
  @IsOptional() @IsString() @MaxLength(80) automationRunId?: string;
  @IsOptional() @IsObject() @ValidateNested() @Type(() => TipRationaleDto) rationale?: TipRationaleDto;
}

export class StartRunDto {
  @IsString() @MinLength(1) @MaxLength(120) workflowName!: string;
  @IsOptional() @IsString() @MaxLength(120) externalRunId?: string;
  @IsOptional() @IsUrl({ protocols: ['https'], require_protocol: true }) @MaxLength(2048) externalRunUrl?: string;
}

export class FinishRunDto {
  @IsIn(['succeeded', 'failed', 'partial']) status!: 'succeeded' | 'failed' | 'partial';
  @IsOptional() @IsInt() @Min(0) createdCount?: number;
  @IsOptional() @IsInt() @Min(0) rejectedCount?: number;
  @IsOptional() @IsString() @MaxLength(2000) errorSummary?: string;
}
