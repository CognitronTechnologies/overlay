import {
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class TrackAffiliateClickDto {
  @IsOptional()
  @IsString()
  offerId?: string;

  /**
   * FREE_BETS
   * HOME
   * TIP_PAGE
   * ARTICLE
   * FOOTER
   * HEADER
   */
  @IsString()
  @MaxLength(50)
  source!: string;

  /**
   * Page pathname or URL.
   */
  @IsString()
  page!: string;

  /**
   * ISO country code if already known by the client.
   * The backend may override this using GeoIP.
   */
  @IsOptional()
  @IsString()
  @MaxLength(2)
  country?: string;
}
