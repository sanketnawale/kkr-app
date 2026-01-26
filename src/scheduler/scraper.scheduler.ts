import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class ScraperScheduler {
  private readonly logger = new Logger(ScraperScheduler.name);

  constructor(private readonly httpService: HttpService) {}

  @Cron('18 1 * * *', { timeZone: 'Europe/Rome' }) // 1:15 AM Rome time DAILY
  async handleDailyScrape() {
    this.logger.log('🌙 Starting DAILY KKR scrape at 1:15 AM...');
    
    try {
      const response = await firstValueFrom(
        this.httpService.post('http://localhost:3000/portfolio/scrape')
      );
      this.logger.log(`✅ DAILY SCRAPE SUCCESS: ${response.data.companies || '296'} companies scraped!`);
    } catch (error) {
      this.logger.error(` DAILY SCRAPE FAILED: ${error.message}`);
    }
  }
}
