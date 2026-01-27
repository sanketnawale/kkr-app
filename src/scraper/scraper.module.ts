import { Module } from '@nestjs/common';
import { ScraperService } from './scraper.service';
import { BotModule } from 'src/bot/bot.module';

@Module({
  imports: [BotModule],
  providers: [ScraperService],
  exports: [ScraperService],
})
export class ScraperModule {}
