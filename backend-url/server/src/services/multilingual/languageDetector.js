/**
 * Detects whether a website supports Hindi, Marathi, or Tamil
 * by inspecting hreflang alternate links, language switcher dropdowns/selects,
 * navigation links, buttons, and route patterns.
 */

const TARGET_LANGUAGES = [
  {
    lang: 'hi',
    label: 'Hindi',
    nativeName: 'हिन्दी',
    aliases: ['hi', 'hi-in', 'hin', 'hindi', 'हिन्दी', 'हिंदी'],
    regex: '(?:^|\\b)(?:hi|hin|hindi)(?:$|\\b)|हिन्दी|हिंदी',
    routePatterns: ['/hi/', '/hi', '?lang=hi', '&lang=hi', '?locale=hi', '&locale=hi'],
  },
  {
    lang: 'mr',
    label: 'Marathi',
    nativeName: 'मराठी',
    aliases: ['mr', 'mr-in', 'mar', 'marathi', 'मराठी'],
    regex: '(?:^|\\b)(?:mr|mar|marathi)(?:$|\\b)|मराठी',
    routePatterns: ['/mr/', '/mr', '?lang=mr', '&lang=mr', '?locale=mr', '&locale=mr'],
  },
  {
    lang: 'ta',
    label: 'Tamil',
    nativeName: 'தமிழ்',
    aliases: ['ta', 'ta-in', 'tam', 'tamil', 'தமிழ்'],
    regex: '(?:^|\\b)(?:ta|tam|tamil)(?:$|\\b)|தமிழ்',
    routePatterns: ['/ta/', '/ta', '?lang=ta', '&lang=ta', '?locale=ta', '&locale=ta'],
  },
];

/**
 * Detect supported languages from a Playwright Page instance.
 * @param {import('playwright').Page} page
 * @returns {Promise<Array<{ lang: string, label: string, nativeName: string, switchMethod: string, targetUrl?: string, selector?: string, value?: string }>>}
 */
export async function detectSupportedLanguages(page) {
  try {
    const detected = await page.evaluate((targetLangs) => {
      const results = [];
      const currentUrl = window.location.href;
      const origin = window.location.origin;

      // 1. Check <link rel="alternate" hreflang="...">
      const hreflangs = Array.from(document.querySelectorAll('link[rel="alternate"][hreflang]'));
      for (const link of hreflangs) {
        const hLang = (link.getAttribute('hreflang') || '').toLowerCase().trim();
        const href = link.getAttribute('href');
        if (!href) continue;

        for (const target of targetLangs) {
          if (target.aliases.includes(hLang) || target.aliases.includes(hLang.split('-')[0])) {
            try {
              const resolvedUrl = new URL(href, currentUrl).href;
              if (resolvedUrl !== currentUrl && !results.some(r => r.lang === target.lang)) {
                results.push({
                  lang: target.lang,
                  label: target.label,
                  nativeName: target.nativeName,
                  switchMethod: 'url',
                  targetUrl: resolvedUrl,
                });
              }
            } catch {
              // ignore invalid url
            }
          }
        }
      }

      // 2. Check <select> dropdowns (common language switchers)
      const selects = Array.from(document.querySelectorAll('select'));
      for (const select of selects) {
        const selectId = select.id ? `#${select.id}` : '';
        const selectName = select.name ? `select[name="${select.name}"]` : '';
        const selector = selectId || selectName || 'select';

        const options = Array.from(select.options);
        for (const opt of options) {
          const val = (opt.value || '').toLowerCase().trim();
          const text = (opt.textContent || '').trim();

          for (const target of targetLangs) {
            const matchesVal = target.aliases.includes(val) || target.aliases.includes(val.split('-')[0]);
            const matchesText = new RegExp(target.regex, 'i').test(text);

            if ((matchesVal || matchesText) && !results.some(r => r.lang === target.lang)) {
              results.push({
                lang: target.lang,
                label: target.label,
                nativeName: target.nativeName,
                switchMethod: 'select',
                selector,
                value: opt.value,
              });
            }
          }
        }
      }

      // 3. Check <a> links (anchors inside nav, header, footer, or switcher bars)
      const links = Array.from(document.querySelectorAll('a[href]'));
      for (const a of links) {
        const href = a.getAttribute('href') || '';
        const text = (a.textContent || '').trim();
        const aria = (a.getAttribute('aria-label') || '').trim();

        for (const target of targetLangs) {
          if (results.some(r => r.lang === target.lang)) continue;

          // Check if link text or attribute explicitly matches target language
          const matchesLangText = new RegExp(target.regex, 'i').test(text) || new RegExp(target.regex, 'i').test(aria);
          const matchesHref = target.routePatterns.some(p => href.includes(p)) ||
            href.endsWith(`/${target.lang}.html`) ||
            href.includes(`/${target.lang}/`) ||
            href.includes(`lang=${target.lang}`) ||
            href.includes(`locale=${target.lang}`);

          if (matchesLangText || matchesHref) {
            try {
              const resolvedUrl = new URL(href, currentUrl).href;
              if (resolvedUrl !== currentUrl && resolvedUrl.startsWith(origin)) {
                results.push({
                  lang: target.lang,
                  label: target.label,
                  nativeName: target.nativeName,
                  switchMethod: 'url',
                  targetUrl: resolvedUrl,
                });
              } else if (href.startsWith('#') || href.startsWith('javascript:')) {
                results.push({
                  lang: target.lang,
                  label: target.label,
                  nativeName: target.nativeName,
                  switchMethod: 'click',
                  selector: a.id ? `#${a.id}` : `a[href="${href}"]`,
                });
              }
            } catch {
              // ignore invalid url
            }
          }
        }
      }

      // 4. Check <button> elements with language indicators
      const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
      for (const btn of buttons) {
        const text = (btn.textContent || '').trim();
        const aria = (btn.getAttribute('aria-label') || '').trim();
        const dataLang = (btn.getAttribute('data-lang') || btn.getAttribute('data-locale') || '').toLowerCase();

        for (const target of targetLangs) {
          if (results.some(r => r.lang === target.lang)) continue;

          const matchesData = target.aliases.includes(dataLang);
          const matchesText = new RegExp(target.regex, 'i').test(text) || new RegExp(target.regex, 'i').test(aria);

          if (matchesData || matchesText) {
            const btnSelector = btn.id ? `#${btn.id}` : (btn.className ? `.${btn.className.trim().split(/\s+/)[0]}` : 'button');
            results.push({
              lang: target.lang,
              label: target.label,
              nativeName: target.nativeName,
              switchMethod: 'click',
              selector: btnSelector,
            });
          }
        }
      }

      return results;
    }, TARGET_LANGUAGES);

    return detected;
  } catch (err) {
    console.warn('Error during language detection:', err.message);
    return [];
  }
}

export { TARGET_LANGUAGES };
