import { Controller, Get, Post, Query, Logger } from '@nestjs/common';
import { PortfolioService } from './portfolio.service';
import { ScraperService } from '../scraper/scraper.service';
import { QueryCompanyDto } from './dto/query-company.dto';

@Controller('portfolio')
export class PortfolioController {
  private readonly logger = new Logger(PortfolioController.name);

  constructor(
    private readonly portfolioService: PortfolioService,
    private readonly scraperService: ScraperService,
  ) {}

  @Post('scrape')
  async scrape() {
    this.logger.log('Starting scrape job...');
    const startTime = Date.now();

    const companies = await this.scraperService.scrapePortfolio();
    const saved = await this.portfolioService.saveCompanies(
      companies,
      'https://www.kkr.com/invest/portfolio',
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    return {
      success: true,
      scraped: companies.length,
      saved,
      durationSeconds: duration,
    };
  }

  @Get('companies')
  async getCompanies(@Query() query: QueryCompanyDto) {
    return this.portfolioService.findAll(query);
  }

  @Get('stats')
  async getStats() {
    return this.portfolioService.getStats();
  }
}
