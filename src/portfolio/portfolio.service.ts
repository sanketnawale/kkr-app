import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Company, CompanyDocument } from './schemas/company.schema';
import { ScrapedCompany } from '../scraper/scraper.service';
import { QueryCompanyDto } from './dto/query-company.dto';

@Injectable()
export class PortfolioService {
  private readonly logger = new Logger(PortfolioService.name);

  constructor(
    @InjectModel(Company.name)
    private companyModel: Model<CompanyDocument>,
  ) {}

  async saveCompanies(
    companies: ScrapedCompany[],
    sourceUrl: string,
  ): Promise<number> {
    let saved = 0;

    for (const company of companies) {
      const sourceKey = `kkr:${company.name.toLowerCase()}`;

      await this.companyModel.updateOne(
        { sourceKey },
        {
          $set: {
            sourceKey,
            sourceUrl,
            name: company.name,
            description: company.description,
            assetClass: company.assetClass,
            industry: company.industry,
            region: company.region,
            hq: company.hq,
            website: company.website,
            year: company.year,
            logoUrl: company.logoUrl,
            updatedAt: new Date(),
            
          },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true },
      );

      saved++;
    }

    this.logger.log(`Saved ${saved} companies to database`);
    return saved;
  }

  // portfolio.service.ts - FIXED WITH SMART REGION SEARCH! 🔥

  // portfolio.service.ts - KEYWORD SEARCH EVERYWHERE!
  async findAll(query: QueryCompanyDto): Promise<Company[]> {
    const filter: any = {};
    const limit = query.limit || 100;

    // 🔥 KEYWORD SEARCH: "europe" finds ANY region with "europe" inside!
    if (query.region) {
      filter.region = { $regex: query.region, $options: 'i' };  // SIMPLE & PERFECT!
    }

    if (query.assetClass) {
      filter.assetClass = { $regex: query.assetClass, $options: 'i' };  // Bonus!
    }

    if (query.industry) {
      filter.industry = { $regex: query.industry, $options: 'i' };  // Bonus!
    }

    if (query.year) filter.year = query.year;
    if (query.year_gte) filter.year = { $gte: parseInt(query.year_gte) };

    console.log(`🔍 Searching:`, JSON.stringify(filter));

    return this.companyModel.find(filter).limit(limit).exec();
  }



  async count(): Promise<number> {
    return this.companyModel.countDocuments().exec();
  }

  async getStats() {
    const total = await this.count();

    const byAssetClass = await this.companyModel.aggregate([
      { $group: { _id: '$assetClass', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const byRegion = await this.companyModel.aggregate([
      { $group: { _id: '$region', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const byIndustry = await this.companyModel.aggregate([
      { $group: { _id: '$industry', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    return {
      total,
      byAssetClass,
      byRegion,
      byIndustry,
    };
  }
}
