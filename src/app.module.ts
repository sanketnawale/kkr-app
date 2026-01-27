import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { PortfolioModule } from './portfolio/portfolio.module';
import { ScraperModule } from './scraper/scraper.module';
import databaseConfig from './config/database.config';
import { ScheduleModule } from '@nestjs/schedule';
import { ScraperScheduler } from './scheduler/scraper.scheduler';
import { HttpModule } from '@nestjs/axios';
import { TelegramBotService } from './bot/telegram-bot.service';
import { PortfolioService } from './portfolio/portfolio.service';


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig],
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('database.uri'),
      }),
      inject: [ConfigService],
    }),
    ScheduleModule.forRoot(),        
    HttpModule,                      
    ScraperModule,
    PortfolioModule,
  ],
  providers: [ScraperScheduler, TelegramBotService, PortfolioService],
})
export class AppModule {}
