import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');
  
  logger.log('🚨 ENV DEBUG:', {
    TG_BOT_TOKEN: !!process.env.TG_BOT_TOKEN ? 'SET ✅' : 'MISSING ❌',
    MONGODB_URI: !!process.env.MONGODB_URI ? 'SET ✅' : 'MISSING ❌',
    PORT: process.env.PORT || 3000
  });
  app.enableCors();
  
  const port = process.env.PORT || 3000;
  await app.listen(port);
  
  logger.log(`🚀 Application running on: http://localhost:${port}`);
  logger.log(`📊 Scrape endpoint: POST http://localhost:${port}/portfolio/scrape`);
  logger.log(`📋 Companies endpoint: GET http://localhost:${port}/portfolio/companies`);
  logger.log(`📈 Stats endpoint: GET http://localhost:${port}/portfolio/stats`);
}

bootstrap();
