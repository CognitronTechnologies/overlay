import { IsEnum } from 'class-validator';

export enum ArticleAuthorStatusDto {
  pending = 'pending',
  approved = 'approved',
  suspended = 'suspended',
}

export class UpdateArticleAuthorStatusDto {
  @IsEnum(ArticleAuthorStatusDto)
  articleAuthorStatus!: ArticleAuthorStatusDto;
}