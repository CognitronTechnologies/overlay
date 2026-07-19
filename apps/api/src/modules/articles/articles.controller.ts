import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ArticlesService } from './articles.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';
import { UpdateArticleAuthorStatusDto } from './dto/update-article-author-status.dto';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { RolesGuard, Roles } from '../../common/roles.guard';
import { CurrentUser } from '../../common/current-user.decorator';
import type { AuthUser } from '../../common/crypto';

@Controller('articles')
export class ArticlesController {
  constructor(private readonly articles: ArticlesService) {}

  // ---- public ----

  @Get()
  list(
    @Query('tag') tag?: string,
    @Query('category') category?: string,
    @Query('take') take?: string,
    @Query('skip') skip?: string,
  ) {
    return this.articles.listPublished({
      tag,
      category:
        category === 'news'
          ? 'news'
          : category === 'content'
            ? 'content'
            : undefined,
      take: take ? Number(take) : undefined,
      skip: skip ? Number(skip) : undefined,
    });
  }

  @Get('tags')
  tags() {
    return this.articles.listTags();
  }

  @Get('sitemap')
  sitemap() {
    return this.articles.listPublishedSlugs();
  }

  // @Get(':slug')
  // bySlug(@Param('slug') slug: string) {
  //   return this.articles.getPublishedBySlug(slug);
  // }

  @Get(':slug')
bySlug(@Param('slug') slug: string) {
  console.log('Slug route hit:', slug);
  return this.articles.getPublishedBySlug(slug);
}

  // ---- authoring ----

  @Get('manage/mine')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'tipster')
  mine(@CurrentUser() user: AuthUser) {
    return this.articles.listMine(user);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'tipster')
  create(
    @Body() dto: CreateArticleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.articles.create(user, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'tipster')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateArticleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.articles.update(id, dto, user);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'tipster')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.articles.remove(id, user);
  }

  // ---- admin ----

  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  all() {
    return this.articles.listAll();
  }

  @Get('admin/authors')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  authors() {
    return this.articles.listAuthors();
  }

  @Patch('admin/authors/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  updateAuthorStatus(
    @Param('userId') userId: string,
    @Body() dto: UpdateArticleAuthorStatusDto,
  ) {
    return this.articles.updateAuthorStatus(userId, dto);
  }
}