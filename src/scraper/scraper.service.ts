import { Injectable, Logger } from '@nestjs/common';
import { chromium, Locator, Page } from 'playwright';
import { ConfigService } from '@nestjs/config';
import { TelegramBotService } from '../bot/telegram-bot.service';

export interface ScrapedCompany {
  name: string;
  description?: string;
  assetClass?: string;
  industry?: string;
  region?: string;
  hq?: string;
  website?: string;
  year?: number;
  logoUrl?: string;
  lastScraped?: Date; 
  sourceKey?: string; 
}

@Injectable()
export class ScraperService {
  private readonly logger = new Logger(ScraperService.name);
  private readonly kkrUrl: string;

  // Prevent concurrent scrapes (Swagger/Postman double-click, retries, etc.)
  private isRunning = false;

  constructor(private readonly configService: ConfigService, private telegramBotService: TelegramBotService) {
    this.kkrUrl =
      this.configService.get<string>('KKR_URL') ||
      'https://www.kkr.com/invest/portfolio';
  }

  async scrapePortfolio(): Promise<ScrapedCompany[]> {
    if (this.isRunning) {
      this.logger.warn(' Scrape already running. Ignoring this request.');
      return [];
    }
    this.isRunning = true;

    this.logger.log(' KKR Scraper (all pages via right-arrow, row-bound popup)');

    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    try {
      await page.goto(this.kkrUrl, { waitUntil: 'networkidle' });
      await this.dismissOneTrust(page);

      const all: ScrapedCompany[] = [];
      let pageNo = 1;

      while (true) {
        this.logger.log(`\n📄 Scraping page ${pageNo}...`);

        const companiesThisPage = await this.scrapeCurrentPage(page);
        all.push(...companiesThisPage);

        const moved = await this.goNextPage(page);
        if (!moved) break;

        pageNo++;
      }

      this.logger.log(`Done. Scraped ${all.length} companies (all pages)`);
      return all;
    } catch (e: any) {
      this.logger.error(` scrape error: ${e?.message || e}`);
      throw e;
    } finally {
      this.isRunning = false;
      await browser.close().catch(() => undefined);
    }
  }

  // -------------------------
  // Page scraping
  // -------------------------

  private normalizeText(s: string): string {
    return s.replace(/\s+/g, ' ').trim();
  }

  private async scrapeCurrentPage(page: Page): Promise<ScrapedCompany[]> {
    await this.dismissOneTrust(page);

    const rows = page.locator('tr.toggle-table-row-click');
    await rows.first().waitFor({ state: 'visible', timeout: 60_000 });

    const totalRows = await rows.count();
    this.logger.log(`Found ${totalRows} rows on current page`);

    const companies: ScrapedCompany[] = [];

    for (let i = 0; i < totalRows; i++) {
      const row = rows.nth(i);

      try {
        await this.dismissOneTrust(page);

        // Some pages re-render; ensure the row is stable & in view
        await row.scrollIntoViewIfNeeded();

        // Basic fields
        const imageContainer = row.locator('.image-container');
        const name = await this.extractCompanyName(imageContainer);

        const tds = row.locator('td');
        const assetClass = this.normalizeText(await tds.nth(1).innerText());
        const industry = this.normalizeText(await tds.nth(2).innerText());
        const region = this.normalizeText(await tds.nth(3).innerText());

        // Open popup (click the correct trigger)
        const opened = await this.tryOpenDetails(imageContainer, page);

        let details: Partial<ScrapedCompany> = {};
        if (opened) {
          details = await this.extractDetailsForRow(row, page);
          await this.closeDetails(page, row);
        }

        const sourceKey = `kkr:${name.toLowerCase().replace(/\s+/g, '-')}`;
        companies.push({ 
          name, 
          assetClass, 
          industry, 
          region, 
          ...details,
          sourceKey,                    // ← NEW!
          lastScraped: new Date()       // ← NEW! Fresh every scrape
        });


        this.logger.log(` ${i + 1}/${totalRows} ${name} | ${assetClass}`);
      } catch (err: any) {
        // If the browser is closed, stop cleanly (don’t spam 15 errors)
        if (String(err?.message || err).includes('Target page, context or browser has been closed')) {
          this.logger.error(' Browser/page closed unexpectedly. Stopping page scrape.');
          break;
        }
        this.logger.error(` Error scraping row ${i + 1}: ${err?.message || err}`);
      }
    }

    return companies;
  }

  // -------------------------
  // Pagination (right arrow)
  // -------------------------

  private async goNextPage(page: Page): Promise<boolean> {
    await this.dismissOneTrust(page);

    const nextArrow = page.locator('.cmp-portfolio-filter__result--pagination-right-arrow');

    // If it doesn't exist at all, no next page
    const count = await nextArrow.count();
    if (count === 0) {
      this.logger.log(' No next-arrow element found. Reached last page.');
      return false;
    }

    // Ensure it is in view (sometimes isVisible() lies if off-screen)
    await nextArrow.scrollIntoViewIfNeeded().catch(() => undefined);

    // Check if actually clickable (style/display)
    const canClick = await nextArrow
      .evaluate((el) => {
        const s = window.getComputedStyle(el);
        return (
          s.display !== 'none' &&
          s.visibility !== 'hidden' &&
          s.pointerEvents !== 'none' &&
          (el as HTMLElement).offsetParent !== null
        );
      })
      .catch(() => false);

    if (!canClick) {
      this.logger.log(' Next arrow not clickable (likely last page).');
      return false;
    }

    // Signature to detect page change
    const firstRow = page.locator('tr.toggle-table-row-click').first();
    const before = await firstRow.getAttribute('data-search-index').catch(() => null);

    // Click next
    await nextArrow.click({ timeout: 15_000 }).catch(async () => {
      await nextArrow.click({ timeout: 15_000, force: true });
    });

    // Wait for rows to load again
    const newFirstRow = page.locator('tr.toggle-table-row-click').first();
    await newFirstRow.waitFor({ state: 'visible', timeout: 30_000 });

    // If we can detect change, wait for it; otherwise a small settle delay
    if (before !== null) {
      await page
        .waitForFunction(
          (prev) => {
            const el = document.querySelector('tr.toggle-table-row-click');
            return el && el.getAttribute('data-search-index') !== prev;
          },
          before,
          { timeout: 30_000 },
        )
        .catch(() => undefined);
    } else {
      await page.waitForTimeout(700);
    }

    return true;
  }

  // -------------------------
  // OneTrust cookie banner
  // -------------------------

  private async dismissOneTrust(page: Page): Promise<void> {
    // Try accept button
    const acceptBtn = page.locator('button#onetrust-accept-btn-handler');
    if (await acceptBtn.count()) {
      await acceptBtn.click({ timeout: 3000 }).catch(() => undefined);
    }

    // If SDK disappears, great
    await page
      .locator('#onetrust-consent-sdk')
      .waitFor({ state: 'detached', timeout: 2000 })
      .catch(() => undefined);

    // Fallback: prevent overlay from intercepting pointer events
    await page
      .evaluate(() => {
        const dark = document.querySelector('.onetrust-pc-dark-filter');
        if (dark && dark instanceof HTMLElement) dark.style.pointerEvents = 'none';

        const sdk = document.querySelector('#onetrust-consent-sdk');
        if (sdk && sdk instanceof HTMLElement) sdk.style.pointerEvents = 'none';
      })
      .catch(() => undefined);
  }

  // -------------------------
  // Row opening / closing
  // -------------------------

  private async extractCompanyName(imageContainer: Locator): Promise<string> {
    const raw = this.normalizeText(await imageContainer.innerText());
    return raw.replace(/\+/g, '').trim();
  }

  private async tryOpenDetails(imageContainer: Locator, page: Page): Promise<boolean> {
    await this.dismissOneTrust(page);

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await imageContainer.scrollIntoViewIfNeeded();
        await imageContainer.click({ timeout: 10_000 });

        // Wait for either: modal row inserted OR flyout visible
        const flyout = page.locator('.cmp-portfolio-filter__flyout-body');
        const anyModalRow = page.locator('tr.modal-content-row');

        const opened =
          (await flyout.isVisible().catch(() => false)) ||
          (await anyModalRow.first().isVisible().catch(() => false));

        if (opened) return true;

        await page.waitForTimeout(250);
      } catch (e) {
        if (attempt === 2) {
          await imageContainer.click({ timeout: 10_000, force: true }).catch(() => undefined);
        }
        await page.waitForTimeout(250);
      }
    }

    return false;
  }

  private async closeDetails(page: Page, row: Locator): Promise<void> {
    // Try ESC first
    await page.keyboard.press('Escape').catch(() => undefined);
    await page.waitForTimeout(150);

    // If the modal row for THIS row is still visible, click the trigger again to collapse
    const modalRow = row
      .locator('xpath=following-sibling::tr[contains(@class,"modal-content-row")]')
      .first();

    if (await modalRow.isVisible().catch(() => false)) {
      const trigger = row.locator('.image-container');
      await trigger.click({ timeout: 5000, force: true }).catch(() => undefined);
      await page.waitForTimeout(150);
    }

    // If flyout still open, click outside
    const flyout = page.locator('.cmp-portfolio-filter__flyout-body');
    if (await flyout.isVisible().catch(() => false)) {
      await page.mouse.click(5, 5);
      await page.waitForTimeout(150);
    }
  }

  // -------------------------
  // Extract popup details (ROW-BOUND)
  // -------------------------

  private async extractDetailsForRow(row: Locator, page: Page): Promise<Partial<ScrapedCompany>> {
    //  Correct: the details row is the next sibling modal row after the clicked row
    const modalRow = row
      .locator('xpath=following-sibling::tr[contains(@class,"modal-content-row")]')
      .first();

    if (await modalRow.isVisible().catch(() => false)) {
      const description = await modalRow
        .locator('.cmp-portfolio-filter__portfolio-description')
        .innerText()
        .then((t) => this.normalizeText(t))
        .catch(() => undefined);

      const hq = await modalRow
        .locator('.hq-details .sub-desc')
        .innerText()
        .then((t) => this.normalizeText(t))
        .catch(() => undefined);

      const websiteRaw = await modalRow
        .locator('.website-details a[href]')
        .getAttribute('href')
        .catch(() => null);
      const website = typeof websiteRaw === 'string' ? websiteRaw : undefined;

      const yearText = await modalRow
        .locator('.year-details .sub-desc')
        .innerText()
        .then((t) => this.normalizeText(t))
        .catch(() => undefined);
      const year = yearText && /^\d{4}$/.test(yearText) ? Number(yearText) : undefined;

      this.logger.log(` EXTRACTED: hq=${hq || 'NO'} website=${website ? 'YES' : 'NO'} year=${year ?? 'NO'}`);

      return { description, hq, website, year };
    }

    // Fallback: flyout mode (if site uses it sometimes)
    const flyout = page.locator('.cmp-portfolio-filter__flyout-body');
    if (await flyout.isVisible().catch(() => false)) {
      const description = await flyout
        .locator('.cmp-portfolio-filter__portfolio-description')
        .innerText()
        .then((t) => this.normalizeText(t))
        .catch(() => undefined);

      const hq = await flyout
        .locator('.hq-details .sub-desc')
        .innerText()
        .then((t) => this.normalizeText(t))
        .catch(() => undefined);

      const websiteRaw = await flyout
        .locator('.website-details a[href]')
        .getAttribute('href')
        .catch(() => null);
      const website = typeof websiteRaw === 'string' ? websiteRaw : undefined;

      const yearText = await flyout
        .locator('.year-details .sub-desc')
        .innerText()
        .then((t) => this.normalizeText(t))
        .catch(() => undefined);
      const year = yearText && /^\d{4}$/.test(yearText) ? Number(yearText) : undefined;

      this.logger.log(` EXTRACTED (flyout): hq=${hq || 'NO'} website=${website ? 'YES' : 'NO'} year=${year ?? 'NO'}`);

      return { description, hq, website, year };
    }

    this.logger.warn(' Popup opened but no row-bound modalRow/flyout found');
    return {};
  }
}
