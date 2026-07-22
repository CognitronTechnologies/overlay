import { PartialType } from '@nestjs/mapped-types';
import { CreateBookmakerDto } from './create-bookmaker.dto';

export class UpdateBookmakerDto extends PartialType(
  CreateBookmakerDto,
) {}