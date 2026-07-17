import { Controller, Get, Query } from '@nestjs/common';
import { SearchService } from './search.service';

/** Public global search across tipsters and articles. */
@Controller('search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  run(@Query('q') q?: string) {
    return this.search.search(q ?? '');
  }
}
