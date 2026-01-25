import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PortfolioController } from './portfolio.controller';
import { PortfolioService } from './portfolio.service';
import { Company, CompanySchema } from './schemas/company.schema';
import { ScraperModule } from '../scraper/scraper.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Company.name, schema: CompanySchema }]),
    ScraperModule,
  ],
  controllers: [PortfolioController],
  providers: [PortfolioService],
  exports: [PortfolioService],
})
export class PortfolioModule {}
