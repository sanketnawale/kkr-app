import { Injectable, Logger } from '@nestjs/common';
import TelegramBot from 'node-telegram-bot-api'; 

@Injectable()
export class TelegramBotService {
  private readonly logger = new Logger(TelegramBotService.name);
  private bot: TelegramBot;

  constructor() {
    const token = process.env.TG_BOT_TOKEN;
    if (!token) {
      this.logger.warn('TG_BOT_TOKEN not set - Telegram bot disabled');
      return;
    }

    this.bot = new TelegramBot(token, { polling: true });
    this.setupCommands();
    this.logger.log(' Telegram bot started! t.me/My_kkrbot');
  }

  private setupCommands() {
    // /start
    this.bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;
      this.bot.sendMessage(chatId, `
 *KKR Portfolio Bot*

*Commands:*
/stats -  Portfolio statistics
/companies -  List companies  
/companies (region) - Filter by region
/scrape -  Fresh scrape (~7min)
/raw -  Raw JSON stats
/help - This message

*Live API:* 213.199.48.152:3001/portfolio/stats
      `, { parse_mode: 'Markdown' });
    });

    // /help
    this.bot.onText(/\/help/, (msg) => {
      this.bot.sendMessage(msg.chat.id, this.getHelpText(), { parse_mode: 'Markdown' });
    });

    // /stats
    this.bot.onText(/\/stats/, async (msg) => {
      const chatId = msg.chat.id;
      await this.sendStats(chatId);
    });

    // /scrape
    this.bot.onText(/\/scrape/, async (msg) => {
      const chatId = msg.chat.id;
      await this.bot.sendMessage(chatId, '🚀 Starting fresh KKR scrape... (~7 mins)');
      
      try {
        const response = await fetch('http://213.199.48.152:3001/portfolio/scrape', {
          method: 'POST'
        });
        await this.bot.sendMessage(chatId, ' Scrape triggered! Check /stats in 7 mins');
      } catch (error) {
        await this.bot.sendMessage(chatId, ` Scrape failed: ${error.message}`);
      }
    });

    // /companies OR /companies Europe
    this.bot.onText(/\/companies(?:\s+(.+))?/, async (msg, match) => {
      const chatId = msg.chat.id;
      const region = match?.[1];
      
      try {
        const url = region 
          ? `http://213.199.48.152:3001/portfolio/companies?region=${encodeURIComponent(region)}&limit=10`
          : 'http://213.199.48.152:3001/portfolio/companies?limit=10';
        
        const response = await fetch(url);
        const companies = await response.json();
        
        if (companies.length === 0) {
          return this.bot.sendMessage(chatId, ' No companies found');
        }

        const text = companies.map((c, i) => 
          `${i+1}. *${c.name}*\n   ${c.assetClass} | ${c.region}`
        ).join('\n');
        
        await this.bot.sendMessage(chatId, `*Top ${companies.length} companies:*\n\n${text}`, { 
          parse_mode: 'Markdown',
          disable_web_page_preview: true 
        });
      } catch (error) {
        await this.bot.sendMessage(chatId, ` Error: ${error.message}`);
      }
    });

    // /raw - Full JSON
    this.bot.onText(/\/raw/, async (msg) => {
      const chatId = msg.chat.id;
      try {
        const response = await fetch('http://213.199.48.152:3001/portfolio/stats');
        const stats = await response.json();
        
        const jsonText = `\`\`\`json\n${JSON.stringify(stats, null, 2)}\n\`\`\``;
        await this.bot.sendMessage(chatId, jsonText, { parse_mode: 'Markdown' });
      } catch (error) {
        await this.bot.sendMessage(chatId, ` Raw stats error: ${error.message}`);
      }
    });
  }

  private async sendStats(chatId: number) {
    try {
      this.bot.sendMessage(chatId, ' Fetching stats...');
      
      const response = await fetch('http://213.199.48.152:3001/portfolio/stats');
      const stats = await response.json();
      
      const peCount = stats.byAssetClass.find((c: any) => c._id === 'Private Equity')?.count || 0;
      const topRegion = stats.byRegion[0];
      
      const text = `
 *KKR Portfolio Stats*

*Total:* ${stats.total} companies
*Private Equity:* ${peCount}
*Top Region:* ${topRegion?._id} (${topRegion?.count})

*By Asset Class:*
${stats.byAssetClass.slice(0, 5).map((c: any) => `• ${c._id}: ${c.count}`).join('\n')}

*Last scrape:* Fresh data! 
      `;
      
      await this.bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
    } catch (error) {
      await this.bot.sendMessage(chatId, ` Stats error: ${error.message}`);
    }
  }

  private getHelpText() {
    return `
 *KKR Portfolio Bot Commands*

/start - Welcome message
/stats -  Portfolio statistics  
/companies -  List companies (top 10)
/companies Europe - Filter by region
/scrape -  Trigger fresh scrape (~7min)
/raw -  Raw JSON stats
/help - Show this help

*Live API endpoints:*
 https://213.199.48.152:3001/portfolio/stats
    `;
  }

  // Send scraper notifications
  async notifyAdmin(text: string) {
    const adminChatId = parseInt(process.env.ADMIN_CHAT_ID || '0');
    if (adminChatId && this.bot) {
      await this.bot.sendMessage(adminChatId, text);
    }
  }
}
