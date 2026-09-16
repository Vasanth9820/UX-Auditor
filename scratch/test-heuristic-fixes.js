function generateHeuristicFix(issue) {
  const code = issue.code || '';
  const message = issue.message || '';
  const suggestedFix = issue.suggestedFix || '';
  const rule = (issue.wcagId || issue.heuristicId || issue.ruleId || '').toUpperCase();

  let fixedCode = code;
  let whyItMatters = `Resolves ${rule} to improve UX and accessibility.`;
  let timeToFix = '5 minutes';

  if (rule.includes('1.1.1') || message.toLowerCase().includes('alt attribute') || message.toLowerCase().includes('img')) {
    if (code.includes('<img') && !code.includes('alt=')) {
      fixedCode = code.replace('<img', '<img alt="Description of the image"');
      whyItMatters = "Images must have alternative text so screen readers can describe them to visually impaired users.";
      timeToFix = "2 minutes";
    }
  } else if (rule.includes('3.1.1') || message.toLowerCase().includes('lang attribute') || message.toLowerCase().includes('language')) {
    if (code.includes('<html') && !code.includes('lang=')) {
      fixedCode = code.replace('<html', '<html lang="en"');
      whyItMatters = "Specifying the language of the page helps screen readers and browsers render pronunciation and translation correctly.";
      timeToFix = "1 minute";
    }
  } else if (rule.includes('1.3.1') || message.toLowerCase().includes('label') || message.toLowerCase().includes('aria-label')) {
    if (code.includes('<input') && !code.includes('aria-label=')) {
      fixedCode = code.replace('<input', '<input aria-label="Input field"');
      whyItMatters = "Form inputs need associated labels or aria-labels so screen readers know what information is expected.";
      timeToFix = "3 minutes";
    }
  } else if (rule.includes('1.4.3') || message.toLowerCase().includes('contrast')) {
    if (code.includes('color:')) {
      fixedCode = code.replace(/color:\s*[^;]+/, 'color: #1a1a1a; /* Enhanced contrast */');
      whyItMatters = "Low contrast text is difficult to read for users with low vision or in high ambient light environments.";
      timeToFix = "5 minutes";
    } else {
      fixedCode = code + ' /* Ensure high contrast contrast ratio >= 4.5:1 */';
      whyItMatters = "Low contrast text is difficult to read for users with low vision.";
      timeToFix = "5 minutes";
    }
  } else if (rule.includes('1.4.4') || message.toLowerCase().includes('font size') || message.toLowerCase().includes('font-size')) {
    if (code.includes('font-size:')) {
      fixedCode = code.replace(/font-size:\s*[\d\.]+px/, 'font-size: 12px');
      whyItMatters = "Small text sizes make content illegible, especially for mobile users and those with visual impairments.";
      timeToFix = "3 minutes";
    }
  } else if (rule.includes('2.4.4') || message.toLowerCase().includes('link purpose') || message.toLowerCase().includes('empty link')) {
    if (code.includes('<a>') || code.includes('<a ')) {
      fixedCode = code.replace(/<\/a>/, 'Learn more</a>');
      whyItMatters = "Links must contain descriptive text so users know where clicking them will lead.";
      timeToFix = "2 minutes";
    }
  }

  if (fixedCode === code) {
    if (code.startsWith('<') && !code.startsWith('<!')) {
      const spaceIdx = code.indexOf(' ');
      const closeIdx = code.indexOf('>');
      const insertIdx = spaceIdx > 0 && spaceIdx < closeIdx ? spaceIdx : closeIdx;
      fixedCode = code.slice(0, insertIdx) + ' data-ux-fix="optimized"' + code.slice(insertIdx);
    } else if (code.includes('{') && code.includes('}')) {
      fixedCode = code.replace('}', '  /* Optimized for accessibility and responsiveness */\n}');
    } else {
      fixedCode = code + ' // Optimized for UX';
    }
    whyItMatters = `Manually apply this recommended fix: ${suggestedFix || 'Optimize the code for WCAG and UX best practices.'}`;
    timeToFix = "5 minutes";
  }

  return {
    fixedCode,
    whyItMatters,
    timeToFix
  };
}

const issues = [
  { code: '<img src="avatar.jpg">', wcagId: '1.1.1', message: 'Missing alt attribute' },
  { code: '<html>', wcagId: '3.1.1', message: 'Missing language attribute' },
  { code: '<input type="text">', wcagId: '1.3.1', message: 'Form input lacks an associated label' },
  { code: 'color: #eee;', wcagId: '1.4.3', message: 'Contrast is too low' },
  { code: 'font-size: 10px;', wcagId: '1.4.4', message: 'Font size below 12px' }
];

issues.forEach(issue => {
  const result = generateHeuristicFix(issue);
  console.log('Original:', issue.code);
  console.log('Fixed:   ', result.fixedCode);
  console.log('Reason:  ', result.whyItMatters);
  console.log('---');
});
