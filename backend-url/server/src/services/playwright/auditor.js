import fs from 'fs/promises';
import path from 'path';
import { chromium, devices } from 'playwright';
import { config } from '../../config/index.js';
import { detectSupportedLanguages } from '../multilingual/languageDetector.js';

const DESKTOP_VIEWPORT = { width: 1440, height: 900 };
const MOBILE_DEVICE = devices['iPhone 13'];

/**
 * Captures page assets, DOM structure, and metadata via Playwright.
 */
export class PlaywrightAuditor {
  constructor(auditId, onProgress) {
    this.auditId = auditId;
    this.onProgress = onProgress || (() => {});
    this.outputDir = path.join(config.outputDir, auditId);
  }

  async ensureOutputDir() {
    await fs.mkdir(this.outputDir, { recursive: true });
  }

  emit(stage, percent, message) {
    this.onProgress({ stage, percent, message });
  }

  async run(url, languageConfig = null) {
    await this.ensureOutputDir();
    this.emit('browser', 5, 'Launching headless browser...');

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: DESKTOP_VIEWPORT,
      recordVideo: {
        dir: this.outputDir,
        size: DESKTOP_VIEWPORT,
      },
      ignoreHTTPSErrors: true,
    });

    const page = await context.newPage();

    try {
      this.emit('navigation', 10, 'Navigating to target URL...');
      let targetUrl = url;
      if (languageConfig?.switchMethod === 'url' && languageConfig?.targetUrl) {
        targetUrl = languageConfig.targetUrl;
      }

      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(2000);

      // Perform native language switch if using select or click
      if (languageConfig && languageConfig.switchMethod !== 'url') {
        this.emit('navigation', 15, `Switching site to ${languageConfig.label || languageConfig.lang}...`);
        if (languageConfig.switchMethod === 'select' && languageConfig.selector) {
          await page.selectOption(languageConfig.selector, languageConfig.value);
          await page.waitForTimeout(2000);
        } else if (languageConfig.switchMethod === 'click' && languageConfig.selector) {
          await page.click(languageConfig.selector);
          await page.waitForTimeout(2000);
        } else {
          throw new Error(`No usable switch control was detected for ${languageConfig.label || languageConfig.lang}`);
        }
      }

      const capture = await this.captureFromPage(page, targetUrl, languageConfig);

      // Detect available languages on the page
      const detectedLanguages = await detectSupportedLanguages(page);
      capture.pageData.detectedLanguages = detectedLanguages;

      const video = page.video();
      let videoPath = null;

      return {
        ...capture,
        page,
        browser,
        context,
        finalize: async () => {
          await context.close().catch(() => {});
          await browser.close().catch(() => {});
          if (video) {
            try {
              const rawVideo = await video.path();
              videoPath = path.join(this.outputDir, 'audit-recording.webm');
              await fs.rename(rawVideo, videoPath).catch(async () => {
                await fs.copyFile(rawVideo, videoPath);
              });
              capture.assets.videoPath = this.toPublicPath(videoPath);
            } catch {
              // video optional
            }
          }
        },
      };
    } catch (error) {
      await context.close().catch(() => {});
      await browser.close().catch(() => {});
      throw error;
    }
  }

  /** Capture page data/assets from an already-open page (keeps browser alive). */
  async captureFromPage(page, url, languageConfig = null) {
    this.emit('capture', 20, 'Extracting page structure and metadata...');
    const pageData = await this.extractPageData(page);

    this.emit('screenshots', 30, 'Capturing desktop screenshot...');
    const desktopScreenshot = path.join(this.outputDir, 'desktop.png');
    await page.screenshot({ path: desktopScreenshot, fullPage: true });

    this.emit('screenshots', 35, 'Capturing section screenshots...');
    const sectionScreenshots = await this.captureSections(page);

    this.emit('html', 40, 'Saving complete HTML snapshot...');
    const html = await page.content();
    const htmlPath = path.join(this.outputDir, 'page.html');
    await fs.writeFile(htmlPath, html, 'utf-8');

    this.emit('mobile', 45, 'Capturing mobile viewport...');
    const mobileResult = await this.captureMobile(url, languageConfig);

    this.emit('capture', 50, 'Page capture complete.');

    return {
      pageData,
      assets: {
        desktopScreenshot: this.toPublicPath(desktopScreenshot),
        mobileScreenshot: mobileResult.screenshot,
        sectionScreenshots,
        videoPath: null,
        htmlPath: this.toPublicPath(htmlPath),
      },
      html,
      mobilePageData: mobileResult.pageData,
    };
  }

  async captureMobile(url, languageConfig = null) {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      ...MOBILE_DEVICE,
      ignoreHTTPSErrors: true,
    });
    const page = await context.newPage();

    try {
      let targetUrl = url;
      if (languageConfig?.switchMethod === 'url' && languageConfig?.targetUrl) {
        targetUrl = languageConfig.targetUrl;
      }
      await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 60000 }).catch(async () => {
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      });
      await page.waitForTimeout(1000);

      if (languageConfig && languageConfig.switchMethod !== 'url') {
        if (languageConfig.switchMethod === 'select' && languageConfig.selector) {
          await page.selectOption(languageConfig.selector, languageConfig.value);
          await page.waitForTimeout(1500);
        } else if (languageConfig.switchMethod === 'click' && languageConfig.selector) {
          await page.click(languageConfig.selector);
          await page.waitForTimeout(1500);
        } else {
          throw new Error(`No usable mobile switch control was detected for ${languageConfig.label || languageConfig.lang}`);
        }
      }

      const screenshotPath = path.join(this.outputDir, 'mobile.png');
      await page.screenshot({ path: screenshotPath, fullPage: true });
      const pageData = await this.extractPageData(page);
      return {
        screenshot: this.toPublicPath(screenshotPath),
        pageData,
      };
    } finally {
      await context.close();
      await browser.close();
    }
  }

  async captureSections(page) {
    const sections = await page.evaluate(() => {
      const selectors = ['header', 'nav', 'main', 'footer', 'section', '[role="main"]'];
      const found = [];
      for (const sel of selectors) {
        document.querySelectorAll(sel).forEach((el, i) => {
          const rect = el.getBoundingClientRect();
          if (rect.width > 50 && rect.height > 50) {
            found.push({
              selector: `${sel}:nth-of-type(${i + 1})`,
              label: el.tagName.toLowerCase() + (el.id ? `#${el.id}` : ''),
              y: rect.y + window.scrollY,
              height: rect.height,
            });
          }
        });
      }
      return found.slice(0, 8);
    });

    const results = [];
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const filePath = path.join(this.outputDir, `section-${i + 1}.png`);
      try {
        await page.evaluate((y) => window.scrollTo(0, y), section.y);
        await page.waitForTimeout(300);
        const el = page.locator(section.selector).first();
        if (await el.count()) {
          await el.screenshot({ path: filePath });
          results.push({
            label: section.label,
            selector: section.selector,
            path: this.toPublicPath(filePath),
          });
        }
      } catch {
        // skip sections that fail to capture
      }
    }
    return results;
  }

  async extractPageData(page) {
    return page.evaluate(() => {
      const getUniqueSelector = (el) => {
        if (!el) return '';
        if (el.id) return `#${el.id}`;
        if (el.className && typeof el.className === 'string') {
          const classes = el.className.trim().split(/\s+/).filter(Boolean);
          for (const cls of classes) {
            const sel = `${el.tagName.toLowerCase()}.${cls}`;
            if (document.querySelectorAll(sel).length === 1) return sel;
          }
          if (classes[0]) return `${el.tagName.toLowerCase()}.${classes[0]}`;
        }
        if (el.tagName === 'IMG') {
          const src = el.getAttribute('src') || el.src || '';
          const partial = src.split('/').pop()?.split('?')[0];
          if (partial) return `img[src*="${partial.slice(0, 60)}"]`;
        }
        if (el.tagName === 'A') {
          const href = el.getAttribute('href');
          if (href && href !== '#') return `a[href="${href}"]`;
        }
        return el.tagName.toLowerCase();
      };

      const getMatchHints = (el) => {
        const hints = {};
        const text = el.textContent?.trim();
        if (text) hints.matchText = text.slice(0, 80);
        if (el.tagName === 'IMG') {
          const src = el.getAttribute('src') || el.src || '';
          hints.src = src.split('/').pop()?.split('?')[0] || src.slice(0, 80);
        }
        if (el.tagName === 'A') hints.href = el.getAttribute('href') || '';
        return hints;
      };

      const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => ({
        level: parseInt(h.tagName[1], 10),
        text: h.textContent?.trim().slice(0, 200) || '',
        selector: getUniqueSelector(h),
      }));

      const links = [...document.querySelectorAll('a[href]')].slice(0, 200).map((a) => ({
        text: a.textContent?.trim().slice(0, 100) || '',
        href: a.getAttribute('href'),
        selector: getUniqueSelector(a),
        hasAriaLabel: !!a.getAttribute('aria-label'),
        opensNewTab: a.target === '_blank',
        ...getMatchHints(a),
      }));

      const buttons = [...document.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"]')]
        .slice(0, 100)
        .map((btn) => ({
          text: btn.textContent?.trim().slice(0, 100) || btn.getAttribute('value') || '',
          type: btn.tagName.toLowerCase(),
          selector: getUniqueSelector(btn),
          disabled: btn.disabled || btn.getAttribute('aria-disabled') === 'true',
          hasLabel: !!(btn.getAttribute('aria-label') || btn.textContent?.trim()),
        }));

      const forms = [...document.querySelectorAll('form')].map((form, fi) => {
        const fields = [...form.querySelectorAll('input, select, textarea')].map((field) => ({
          tag: field.tagName.toLowerCase(),
          type: field.type || 'text',
          name: field.name || field.id || '',
          id: field.id || '',
          hasLabel: !!(
            field.labels?.length ||
            document.querySelector(`label[for="${field.id}"]`) ||
            field.getAttribute('aria-label') ||
            field.getAttribute('aria-labelledby')
          ),
          required: field.required,
          selector: getUniqueSelector(field),
        }));
        return { index: fi, action: form.action, method: form.method, fields };
      });

      const stylesheets = [...document.querySelectorAll('link[rel="stylesheet"], style')];
      let cssRulesCount = 0;
      try {
        for (const sheet of document.styleSheets) {
          try {
            cssRulesCount += sheet.cssRules?.length || 0;
          } catch {
            // cross-origin stylesheets
          }
        }
      } catch {
        // ignore
      }

      const meta = {};
      document.querySelectorAll('meta').forEach((m) => {
        const name = m.getAttribute('name') || m.getAttribute('property');
        if (name) meta[name] = m.getAttribute('content');
      });

      return {
        title: document.title,
        language: document.documentElement.lang || '',
        metaDescription: meta.description || meta['og:description'] || '',
        meta,
        headings,
        links,
        buttons,
        forms,
        htmlLength: document.documentElement.outerHTML.length,
        cssRulesCount,
        stylesheetCount: stylesheets.length,
        images: [...document.querySelectorAll('img')].slice(0, 100).map((img) => ({
          src: img.src?.slice(0, 200),
          alt: img.getAttribute('alt'),
          selector: getUniqueSelector(img),
          matchSrc: getMatchHints(img).src,
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
        })),
        interactiveElements: document.querySelectorAll('a, button, input, select, textarea, [tabindex]').length,
      };
    });
  }

  toPublicPath(filePath) {
    return `/outputs/${this.auditId}/${path.basename(filePath)}`;
  }
}

export default PlaywrightAuditor;
