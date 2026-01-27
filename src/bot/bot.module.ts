// src/bot/bot.module.ts
import { Module } from '@nestjs/common';
import { TelegramBotService } from './telegram-bot.service';

@Module({
  providers: [TelegramBotService],
  exports: [TelegramBotService],  // ← Export for other modules
})
export class BotModule {}
