 KKR Portfolio Scraper & Telegram Bot

Live Telegram Bot:
 https://t.me/My_kkrbot




 Telegram Bot Commands
/start        → Welcome message + menu
/stats        → Live portfolio statistics
/companies    → Top 10 companies
/companies Europe → Filter by region
/raw          → Raw JSON data
/scrape       → Trigger fresh scrape (admin-only)
/help         → Command list

 Production REST API

Base URL

http://213.199.48.152:3001

Endpoints
GET  /portfolio/stats
GET  /portfolio/companies?limit=10
GET  /portfolio/companies?region=Europe
POST /portfolio/scrape   (admin-triggered)

Test API
curl http://213.199.48.152:3001/portfolio/stats
curl "http://213.199.48.152:3001/portfolio/companies?limit=5"


Local Development
Prerequisites

Node.js 18+

Docker

Git

Setup
git clone https://github.com/sanketnawale/kkr-app.git
cd kkr-app

npm install
docker-compose up -d   # MongoDB only
npm run start:dev      # API + Telegram bot


Test:

curl http://localhost:3001/portfolio/stats




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
}

 Architecture
kkr-app/
├── src/
│   ├── bot/           # TelegramBotService (UX layer)
│   ├── portfolio/     # Controller + Service (API)
│   ├── scraper/       # Playwright scraper
│   └── main.ts        # NestJS bootstrap
├── Dockerfile
├── docker-compose.prod.yml
└── .github/workflows/ # CI/CD 