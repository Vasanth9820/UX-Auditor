/**
 * Multilingual and Localization UX & Accessibility checks for Hindi, Marathi, and Tamil pages.
 * Detects untranslated text, mixed languages, text overflow/layout clipping,
 * html lang attribute mismatches, and translation accessibility issues.
 */

const INDIC_SCRIPTS = {
  hi: {
    name: 'Hindi',
    code: 'hi',
    // Devanagari block: \u0900-\u097F
    regex: /[\u0900-\u097F]/,
  },
  mr: {
    name: 'Marathi',
    code: 'mr',
    // Devanagari block: \u0900-\u097F
    regex: /[\u0900-\u097F]/,
  },
  ta: {
    name: 'Tamil',
    code: 'ta',
    // Tamil block: \u0B80-\u0BFF
    regex: /[\u0B80-\u0BFF]/,
  },
};

function createMultilingualIssue(overrides) {
  return {
    id: overrides.id,
    category: 'heuristic',
    rule: overrides.rule,
    title: overrides.title,
    description: overrides.description,
    element: overrides.element || '',
    selector: overrides.selector || '',
    originalCode: overrides.originalCode || '',
    fixedCode: overrides.fixedCode || '',
    explanation: overrides.explanation || overrides.description,
    heuristic: 'Consistency and standards',
    severity: overrides.severity || 'moderate',
    priority: overrides.priority || (overrides.severity === 'critical' ? 'high' : overrides.severity === 'serious' ? 'high' : 'medium'),
    estimatedFixTime: overrides.estimatedFixTime || '15m',
    wcagCriteria: overrides.wcagCriteria || [],
    metadata: overrides.metadata || {},
  };
}

/**
 * Run language-specific checks on an audited localized page.
 * @param {import('playwright').Page} page
 * @param {object} pageData
 * @param {string} html
 * @param {string} targetLang - 'hi' | 'mr' | 'ta'
 * @returns {Promise<Array<object>>}
 */
export async function runMultilingualChecks(page, pageData, html, targetLang) {
  const issues = [];
  const scriptInfo = INDIC_SCRIPTS[targetLang] || INDIC_SCRIPTS.hi;
  const langName = scriptInfo.name;

  // 1. Check <html lang="..."> attribute mismatch (WCAG 3.1.1)
  const currentHtmlLang = (pageData.language || '').toLowerCase().trim();
  const validCodes = [targetLang, `${targetLang}-in`];
  if (!currentHtmlLang || (!validCodes.includes(currentHtmlLang) && !currentHtmlLang.startsWith(targetLang))) {
    issues.push(
      createMultilingualIssue({
        id: `i18n-html-lang-${targetLang}`,
        rule: 'i18n-html-lang-mismatch',
        title: `Incorrect document language attribute for ${langName}`,
        description: `The <html> element has lang="${currentHtmlLang || 'empty'}" instead of lang="${targetLang}". Screen readers will attempt to pronounce ${langName} content using English phonetic rules, making it incomprehensible.`,
        element: 'html',
        selector: 'html',
        originalCode: `<html lang="${currentHtmlLang || ''}">`,
        fixedCode: `<html lang="${targetLang}">`,
        explanation: `Update the <html lang="${targetLang}"> attribute so assistive technologies correctly interpret and vocalize ${langName} text.`,
        severity: 'critical',
        priority: 'high',
        wcagCriteria: ['3.1.1 Language of Page'],
      })
    );
  }

  // 2. Untranslated Headings & Prominent Text Elements
  // Elements that have substantial Latin letters but no Indic script characters
  const headings = pageData.headings || [];
  for (const h of headings) {
    const text = (h.text || '').trim();
    // If text has more than 10 Latin chars and zero Indic characters
    const hasLatin = /[a-zA-Z]{4,}/.test(text);
    const hasIndic = scriptInfo.regex.test(text);

    if (hasLatin && !hasIndic && text.length > 8) {
      issues.push(
        createMultilingualIssue({
          id: `i18n-untranslated-heading-${h.selector}`,
          rule: 'i18n-untranslated-content',
          title: `Untranslated English heading on ${langName} page`,
          description: `Heading "${text.slice(0, 60)}" remains in English on the ${langName} version of the website.`,
          element: `h${h.level}`,
          selector: h.selector,
          originalCode: `<h${h.level}>${text}</h${h.level}>`,
          fixedCode: `<h${h.level}>[Translate to ${langName}]</h${h.level}>`,
          explanation: `All primary headings must be localized into ${langName} to maintain a cohesive user experience.`,
          severity: 'serious',
          priority: 'high',
          metadata: { text, level: h.level },
        })
      );
    }
  }

  // 3. Untranslated Buttons / CTAs
  const buttons = pageData.buttons || [];
  for (const btn of buttons) {
    const text = (btn.text || '').trim();
    const hasLatin = /[a-zA-Z]{3,}/.test(text);
    const hasIndic = scriptInfo.regex.test(text);

    if (hasLatin && !hasIndic && text.length > 3) {
      // Common untranslated buttons: "Submit", "Shop Now", "Add to Cart", "Proceed", "Checkout", "Login"
      issues.push(
        createMultilingualIssue({
          id: `i18n-untranslated-btn-${btn.selector}`,
          rule: 'i18n-untranslated-cta',
          title: `Untranslated Call-to-Action button on ${langName} page`,
          description: `Button labeled "${text}" is not translated into ${langName}. Key actions should always be in the user's selected language.`,
          element: btn.type || 'button',
          selector: btn.selector,
          originalCode: `<button>${text}</button>`,
          fixedCode: `<button>[${langName} Action Label]</button>`,
          explanation: `Translate interactive buttons into ${langName} to prevent user hesitation and confusion.`,
          severity: 'serious',
          priority: 'high',
          metadata: { text },
        })
      );
    }
  }

  // 4. In-browser Live DOM Checks via Playwright:
  // - Text Overflow / Layout Clipping from Indic font expansion
  // - Label-in-Name (aria-label vs visible text mismatch)
  // - Untranslated Input Placeholders
  try {
    const liveIssues = await page.evaluate((info) => {
      const detected = [];
      const indicRegex = new RegExp(info.regexSource);

      // Check 4a: Text Overflow & Layout Clipping
      // Indic scripts (Devanagari, Tamil) typically expand text length by 15-30%.
      // Look for elements with horizontal clipping or scroll overflow.
      const candidateEls = Array.from(document.querySelectorAll('button, a, .btn, [role="button"], h1, h2, h3, p, .product-card, .badge, nav a'));
      for (const el of candidateEls) {
        if (!el || el.offsetParent === null) continue; // skip invisible

        const computed = window.getComputedStyle(el);
        const hasOverflowStyle = ['hidden', 'clip', 'ellipsis'].some(v => computed.overflowX.includes(v) || computed.textOverflow.includes(v));
        const isClipped = el.scrollWidth > el.clientWidth + 4;

        if (isClipped && hasOverflowStyle && el.textContent.trim().length > 0) {
          const sel = el.id ? `#${el.id}` : (el.className ? `${el.tagName.toLowerCase()}.${el.className.trim().split(/\s+/)[0]}` : el.tagName.toLowerCase());
          detected.push({
            type: 'overflow',
            element: el.tagName.toLowerCase(),
            selector: sel,
            text: el.textContent.trim().slice(0, 80),
            scrollWidth: el.scrollWidth,
            clientWidth: el.clientWidth,
          });
        }
      }

      // Check 4b: Accessible Name / aria-label Mismatch (WCAG 2.5.3 Label in Name)
      // When visible text is in Indic script, but aria-label is still English (or vice versa)
      const ariaEls = Array.from(document.querySelectorAll('[aria-label]'));
      for (const el of ariaEls) {
        const visibleText = el.textContent.trim();
        const ariaLabel = (el.getAttribute('aria-label') || '').trim();
        if (!visibleText || !ariaLabel) continue;

        const visibleHasIndic = indicRegex.test(visibleText);
        const ariaHasIndic = indicRegex.test(ariaLabel);

        if (visibleHasIndic && !ariaHasIndic && /[a-zA-Z]{3,}/.test(ariaLabel)) {
          const sel = el.id ? `#${el.id}` : el.tagName.toLowerCase();
          detected.push({
            type: 'aria-mismatch',
            element: el.tagName.toLowerCase(),
            selector: sel,
            visibleText: visibleText.slice(0, 50),
            ariaLabel: ariaLabel.slice(0, 50),
          });
        }
      }

      // Check 4c: Untranslated Input Placeholders
      const inputs = Array.from(document.querySelectorAll('input[placeholder], textarea[placeholder]'));
      for (const input of inputs) {
        const ph = (input.getAttribute('placeholder') || '').trim();
        if (ph && /[a-zA-Z]{4,}/.test(ph) && !indicRegex.test(ph)) {
          const sel = input.id ? `#${input.id}` : (input.name ? `input[name="${input.name}"]` : 'input');
          detected.push({
            type: 'untranslated-placeholder',
            element: input.tagName.toLowerCase(),
            selector: sel,
            placeholder: ph,
          });
        }
      }

      return detected.slice(0, 10);
    }, {
      regexSource: scriptInfo.regex.source,
      langName,
      langCode: targetLang,
    });

    for (const item of liveIssues) {
      if (item.type === 'overflow') {
        issues.push(
          createMultilingualIssue({
            id: `i18n-overflow-${item.selector}`,
            rule: 'i18n-text-overflow',
            title: `Text overflow & layout clipping in ${langName}`,
            description: `Element "${item.text}" has content width (${item.scrollWidth}px) exceeding visible container width (${item.clientWidth}px). ${langName} text expansion has caused text clipping.`,
            element: item.element,
            selector: item.selector,
            originalCode: `<${item.element}>${item.text}</${item.element}>`,
            fixedCode: `<${item.element} style="min-width: max-content; overflow: visible;">${item.text}</${item.element}>`,
            explanation: `Adjust the container width or flexible layout (e.g. min-width: max-content or flex-wrap: wrap) to accommodate ${langName} typographic expansion.`,
            severity: 'serious',
            priority: 'high',
          })
        );
      } else if (item.type === 'aria-mismatch') {
        issues.push(
          createMultilingualIssue({
            id: `i18n-aria-mismatch-${item.selector}`,
            rule: 'i18n-label-in-name',
            title: `Aria-label mismatch with visible ${langName} text`,
            description: `Visible text "${item.visibleText}" is in ${langName}, but the accessible name aria-label="${item.ariaLabel}" is in English. Users navigating with speech input or screen readers will face accessibility barriers.`,
            element: item.element,
            selector: item.selector,
            originalCode: `<${item.element} aria-label="${item.ariaLabel}">${item.visibleText}</${item.element}>`,
            fixedCode: `<${item.element} aria-label="${item.visibleText}">${item.visibleText}</${item.element}>`,
            explanation: `Ensure the accessible name (aria-label) matches the visible ${langName} text in accordance with WCAG 2.5.3 (Label in Name).`,
            severity: 'serious',
            priority: 'high',
            wcagCriteria: ['2.5.3 Label in Name'],
          })
        );
      } else if (item.type === 'untranslated-placeholder') {
        issues.push(
          createMultilingualIssue({
            id: `i18n-placeholder-${item.selector}`,
            rule: 'i18n-untranslated-placeholder',
            title: `Untranslated input placeholder on ${langName} page`,
            description: `Form field placeholder "${item.placeholder}" is still in English.`,
            element: item.element,
            selector: item.selector,
            originalCode: `<input placeholder="${item.placeholder}" />`,
            fixedCode: `<input placeholder="[${langName} Placeholder]" />`,
            explanation: `Provide localized input placeholders for ${langName} users.`,
            severity: 'moderate',
            priority: 'medium',
          })
        );
      }
    }
  } catch (liveErr) {
    console.warn('Multilingual live check evaluation error:', liveErr.message);
  }

  return issues;
}
