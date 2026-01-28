# Scraper Bot


### **Telegram Bot** (UX)
https://t.me/My_kkrbot

Commands:
/start → Welcome + menu
/stats → Live portfolio statistics
/companies → Top 10 companies
/companies Europe → Filter by region
/scrape → Trigger fresh scrape (aol)
/raw → Raw JSON data
/help → Command list


###  **REST API** (Production endpoints)
Base: http://213.199.48.152:3001/portfolio/stats

 GET /portfolio/stats → Portfolio statistics
 GET /portfolio/companies → All companies (limit=10)
 GET /portfolio/companies?region=Europe → Filtered companies
 POST /portfolio/scrape → Trigger fresh scrape

text

**Test API now:**
```bash
curl http://213.199.48.152:3001/portfolio/stats
curl "http://213.199.48.152:3001/portfolio/companies?limit=5"

 LOCAL DEVELOPMENT (Zero Config)
Prerequisites
bash
# Docker (for MongoDB)
# Node.js 18+ (for NestJS)
# Git
Local Setup (5 minutes)
bash
# 1. Clone repo
git clone https://github.com/sanketnawale/kkr-app.git
cd kkr-app

# 2. Start (auto-builds + runs)
npm install
docker-compose up -d  # MongoDB only

# 3. In new terminal
npm run start:dev     # API + Telegram bot

# 4. Open browser
curl http://localhost:3001/portfolio/stats
Expected output:

Telegram bot started! t.me/My_kkrbot LIVE
Application running on: http://localhost:3000
 Total: 200 companies scraped!

Data Model 

interface Company {
  _id: string
  name: string           
  assetClass: string     
  industry: string       
  region: string        
  hq: string             
  description: string   
  website: string        
  year: number           
  sourceUrl: string      
  createdAt: Date
  updatedAt: Date
  
🛠 Production Architecture

kkr-app/
├── src/
│   ├── bot/           # TelegramBotService (UX layer)
│   ├── portfolio/     # Controller + Service (API)
│   ├── scraper/       # Playwright scraper
│   └── main.ts        # NestJS bootstrap
├── Dockerfile         # Multi-stage production
├── docker-compose.prod.yml  # MongoDB + API
└── .github/workflows/ # CI/CD to Contabo
