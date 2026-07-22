import { PartialType } from '@nestjs/mapped-types';
import { CreateAffiliateOfferDto } from './create-affiliate-offer.dto';

export class UpdateAffiliateOfferDto extends PartialType(
  CreateAffiliateOfferDto,
) {}