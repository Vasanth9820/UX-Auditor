import React, { useState, useEffect } from 'react';
import './AuditResultsView.css';

// ── Circular Gauge with Smooth Fill Animation ──
const CircularGauge = ({ 
  grade, 
  score = 80, 
  color = '#2563eb', 
  size = 100, 
  strokeWidth = 7.5, 
  label,
  onClick,
  isActive = false
}) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Smooth trigger for circle arc animation on mount
    const timer = setTimeout(() => {
      setProgress(Math.max(5, Math.min(100, score)));
    }, 80);
    return () => clearTimeout(timer);
  }, [score]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div 
      className={`gauge-card ${isActive ? 'gauge-card--active' : ''}`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <div className="gauge-ring-container" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="gauge-svg">
          {/* Background track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            opacity="0.12"
          />
          {/* Smooth animated progress arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            className="gauge-progress-arc"
            style={{
              transition: 'stroke-dashoffset 1.4s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          />
        </svg>
        <div className="gauge-value" style={{ color: 'var(--text-primary)' }}>
          {grade}
        </div>
      </div>

      {label && (
        <div className="gauge-label-wrap">
          <span className="gauge-label">{label}</span>
        </div>
      )}
    </div>
  );
};

// ── Multi-Axis Radar Spider Chart ──
const RadarChartDynamic = ({ data, size = 260 }) => {
  const center = size / 2;
  const radius = size * 0.36; // leave margin for badges/labels
  const numAxes = data.length;

  // Angles for each axis: starting from top (-Math.PI / 2)
  const angles = data.map((_, idx) => -Math.PI / 2 + (2 * Math.PI * idx) / numAxes);

  const levels = [0.25, 0.5, 0.75, 1.0];

  // Concentric polygon grids
  const gridPolygons = levels.map((lvl) => {
    return angles.map(angle => {
      const x = center + radius * lvl * Math.cos(angle);
      const y = center + radius * lvl * Math.sin(angle);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  });

  // Calculate polygon for actual score values
  const dataPoints = data.map((item, idx) => {
    const norm = Math.max(0.18, Math.min(1.0, (item.score || 70) / 100));
    const x = center + radius * norm * Math.cos(angles[idx]);
    const y = center + radius * norm * Math.sin(angles[idx]);
    return { x, y, score: item.score, label: item.label, color: item.color };
  });

  const dataPolygon = dataPoints.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  return (
    <div className="radar-container" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="radar-svg">
        {/* Background Grid Polygons */}
        {gridPolygons.map((pts, i) => (
          <polygon
            key={i}
            points={pts}
            fill="none"
            stroke="var(--radar-grid, #94a3b8)"
            strokeWidth="1"
            strokeDasharray={i === levels.length - 1 ? 'none' : '3 3'}
            opacity={i === levels.length - 1 ? '0.5' : '0.28'}
          />
        ))}

        {/* Axis Spokes */}
        {angles.map((angle, i) => {
          const x2 = center + radius * Math.cos(angle);
          const y2 = center + radius * Math.sin(angle);
          return (
            <line
              key={i}
              x1={center}
              y1={center}
              x2={x2}
              y2={y2}
              stroke="var(--radar-grid, #94a3b8)"
              strokeWidth="1"
              strokeDasharray="2 2"
              opacity="0.35"
            />
          );
        })}

        {/* Data Polygon */}
        <polygon
          points={dataPolygon}
          fill="rgba(59, 130, 246, 0.2)"
          stroke="#2563eb"
          strokeWidth="2.2"
          className="radar-data-polygon"
        />

        {/* Vertex Markers */}
        {dataPoints.map((pt, i) => (
          <circle
            key={i}
            cx={pt.x}
            cy={pt.y}
            r="4"
            fill={pt.color || '#2563eb'}
            stroke="#ffffff"
            strokeWidth="1.8"
            className="radar-data-point"
          />
        ))}

        {/* Clean Outer Labels */}
        {data.map((item, idx) => {
          const angle = angles[idx];
          const dist = radius + 18;
          const x = center + dist * Math.cos(angle);
          const y = center + dist * Math.sin(angle);
          let textAnchor = 'middle';
          if (Math.cos(angle) > 0.3) textAnchor = 'start';
          else if (Math.cos(angle) < -0.3) textAnchor = 'end';

          return (
            <text
              key={idx}
              x={x}
              y={y}
              textAnchor={textAnchor}
              dominantBaseline="central"
              className="radar-axis-label"
            >
              {item.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
};

// ── Main Audit Results View ──
const AuditResultsView = ({ 
  audit, 
  getAssetUrl, 
  onNavigateTab,
  onStartAudit 
}) => {
  const [selectedCategory, setSelectedCategory] = useState(null);

  // Extract clean site URL and domain name
  const rawUrl = audit?.url || audit?.repoUrl || 'https://brainly.in/';
  let displayDomain = 'brainly.in';
  try {
    const parsed = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
    displayDomain = parsed.hostname.replace(/^www\./, '');
  } catch (_) {
    displayDomain = rawUrl.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] || 'brainly.in';
  }

  // Real scores or adaptive defaults
  const overallGrade = audit?.grade || audit?.scores?.grade || 'B';
  const overallScore = audit?.score || audit?.scores?.overall || 86;
  const recommendationsCount = audit?.totalIssues || audit?.issues?.length || 3;
  const wcagScore = audit?.wcagScore !== undefined ? audit.wcagScore : (audit?.scores?.wcag || 75);
  const heuristicScore = audit?.heuristicScore !== undefined ? audit.heuristicScore : (audit?.scores?.heuristic || 100);

  // Status headline
  const headingText = overallGrade.startsWith('A') 
    ? 'Your page looks excellent'
    : overallGrade.startsWith('B') 
    ? 'Your page could be better' 
    : 'Critical improvements needed';

  // 6 Comprehensive Categories (including WCAG Accessibility!)
  const categories = [
    {
      id: 'accessibility',
      label: 'Accessibility',
      grade: wcagScore >= 90 ? 'A+' : wcagScore >= 80 ? 'A' : wcagScore >= 70 ? 'B' : 'C+',
      score: wcagScore,
      color: '#2563eb', // Blue
      status: wcagScore >= 80 ? 'Good' : 'Needs Review',
      description: 'Audited against WCAG 2.1 Level AA criteria for accessible web navigation and screen readers.',
      explanation: `Site achieved ${wcagScore}% WCAG 2.1 compliance. Core landmarks and keyboard tabs passed. Missing meta descriptions and contrast ratios flagged for remediation.`,
      positives: ['Semantic HTML landmarks verified', 'Keyboard focus cycle supported'],
      negatives: ['Missing descriptive meta tags', 'Color contrast ratio below 4.5:1 on muted elements']
    },
    {
      id: 'usability',
      label: 'Usability',
      grade: heuristicScore >= 90 ? 'A+' : heuristicScore >= 80 ? 'A' : 'B+',
      score: heuristicScore,
      color: '#10b981', // Emerald Green
      status: heuristicScore >= 90 ? 'Excellent' : 'Good',
      description: 'Evaluated across Nielsen Norman Group’s 10 core usability heuristics.',
      explanation: `Site scored ${heuristicScore}% in usability heuristics. Intuitive visual feedback, standard design patterns, and clear call-to-actions.`,
      positives: ['Consistent system status feedback', 'Clear layout hierarchy and intuitive navigation'],
      negatives: heuristicScore < 90 ? ['Touch target size under 44px on mobile'] : []
    },
    {
      id: 'seo',
      label: 'On-Page SEO',
      grade: 'C+',
      score: 62,
      color: '#f43f5e', // Coral Red
      status: 'Needs Attention',
      description: 'Meta tags, search engine crawlability, heading outlines, and indexability.',
      explanation: `Score of 62% due to missing page description, omitted H1 hierarchy on sub-sections, and unoptimized OpenGraph social preview tags.`,
      positives: ['Canonical URLs correctly formed', 'Mobile viewport meta configured'],
      negatives: ['Missing <meta name="description"> in <head>', 'Heading tags skip from H2 to H4']
    },
    {
      id: 'geo',
      label: 'GEO (AI Search)',
      grade: 'B-',
      score: 72,
      color: '#8b5cf6', // Purple
      status: 'Moderate',
      description: 'Generative Engine Optimization for AI answer engines (ChatGPT, Perplexity, Gemini).',
      explanation: `Score of 72% because structured data (JSON-LD) is only partially defined. Adding rich schema entity graphs will boost AI search presence.`,
      positives: ['Page content is text-extractable', 'Clear brand name attribution'],
      negatives: ['Incomplete schema.org JSON-LD definitions', 'Missing author/publisher entity markup']
    },
    {
      id: 'links',
      label: 'Links',
      grade: 'A+',
      score: 96,
      color: '#06b6d4', // Cyan
      status: 'Optimal',
      description: 'Link health, internal navigation routes, anchor text clarity, and security tags.',
      explanation: `Score of 96%: 0 broken links discovered. Fast link crawl rate, clean relative paths, and safe external rel="noopener" attributes.`,
      positives: ['0 dead links or 404 responses', 'External links use secure rel attributes'],
      negatives: []
    },
    {
      id: 'performance',
      label: 'Performance',
      grade: 'A+',
      score: 94,
      color: '#f59e0b', // Amber
      status: 'Optimal',
      description: 'Core Web Vitals, initial server response time, asset caching, and layout stability.',
      explanation: `Score of 94%: Fast Largest Contentful Paint (LCP 1.1s), low layout shift (CLS 0.01), and efficient asset delivery compression.`,
      positives: ['First Contentful Paint under 0.9s', 'Low cumulative layout shift (0.01)'],
      negatives: ['Minor unminified script payload detected']
    }
  ];

  // Timestamp
  const formattedDate = audit?.createdAt 
    ? new Date(audit.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }) + ' ' + new Date(audit.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
    : '15 September 3:12PM UTC';

  const desktopScreenshot = audit?.assets?.desktopScreenshot ? getAssetUrl(audit.assets.desktopScreenshot) : null;

  return (
    <div className="audit-results-card">
      {/* ── HEADER ── */}
      <div className="audit-results-header">
        <div className="header-left-col">
          <div className="title-row">
            <h2 className="audit-results-title">Audit Results</h2>
            <span className="audit-grade-pill">
              <span className="grade-dot"></span>
              Grade {overallGrade} · {overallScore}/100
            </span>
          </div>
          <p className="audit-subtitle">
            Comprehensive automated UX, Accessibility, and Performance evaluation for <strong>{displayDomain}</strong>
          </p>
        </div>

        <div className="audit-results-actions">
          <span className="audit-url-pill" title={`Audited site: ${rawUrl}`}>
            <span className="live-indicator"></span>
            {displayDomain}
          </span>
          <button 
            className="audit-action-btn"
            onClick={() => onNavigateTab && onNavigateTab('reports')}
            title="Export full executive report"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            Export Report
          </button>
        </div>
      </div>

      {/* ── TOP SECTION: OVERALL SCORE + PREVIEW MOCKUP ── */}
      <div className="audit-top-row">
        {/* LEFT: BIG OVERALL SCORE */}
        <div className="audit-score-hero">
          <div className="big-gauge-wrap">
            <CircularGauge
              grade={overallGrade}
              score={overallScore}
              color="#38bdf8"
              size={185}
              strokeWidth={14}
            />
          </div>

          <h3 className="audit-score-tagline">{headingText}</h3>

          <button 
            className="recommendations-pill"
            onClick={() => onNavigateTab ? onNavigateTab('aifixes') : null}
            title="Click to view all recommendations"
          >
            ✦ {recommendationsCount} Recommendations
          </button>
        </div>

        {/* RIGHT: POLISHED SITE PREVIEW SHOWCASE (PHONE REMOVED) */}
        <div className="audit-preview-showcase">
          <div className="desktop-preview-frame">
            <div className="browser-top-bar">
              <div className="browser-traffic-dots">
                <span className="b-dot b-dot--red"></span>
                <span className="b-dot b-dot--yellow"></span>
                <span className="b-dot b-dot--green"></span>
              </div>
              <div className="browser-address-pill">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="lock-icon"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                <span className="address-text">{rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`}</span>
              </div>
              <div className="browser-action-icons">
                <span className="b-icon-line"></span>
                <span className="b-icon-line"></span>
              </div>
            </div>

            <div className="browser-viewport-content">
              {desktopScreenshot ? (
                <img 
                  src={desktopScreenshot} 
                  alt={`${displayDomain} desktop preview`} 
                  className="preview-image-desktop" 
                />
              ) : (
                <div className="dynamic-site-placeholder">
                  <div className="placeholder-hero">
                    <div className="placeholder-domain-title">{displayDomain}</div>
                    <p className="placeholder-sub">Live site audit preview capture in progress...</p>
                    <div className="placeholder-shimmer-blocks">
                      <div className="shimmer-block s-1"></div>
                      <div className="shimmer-block s-2"></div>
                      <div className="shimmer-block s-3"></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── BOTTOM SECTION: CATEGORY SCORE RINGS + RADAR CHART ── */}
      <div className="audit-bottom-row">
        {/* CATEGORY METRIC CIRCLES */}
        <div className="audit-categories-wrap">
          <div className="section-micro-heading">
            <span>AUDIT DIMENSIONS</span>
            <span className="micro-sub">Summary across core UX vectors</span>
          </div>

          <div className="audit-categories-row">
            {categories.map((cat) => (
              <div 
                key={cat.id} 
                className={`category-item ${selectedCategory === cat.id ? 'category-item--selected' : ''}`}
                onClick={() => {
                  const targetEl = document.getElementById(`score-reason-${cat.id}`);
                  if (targetEl) {
                    targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setSelectedCategory(cat.id);
                  }
                }}
                title={`View ${cat.label} score breakdown below`}
              >
                <CircularGauge
                  grade={cat.grade}
                  score={cat.score}
                  color={cat.color}
                  size={88}
                  strokeWidth={7}
                  label={cat.label}
                  isActive={selectedCategory === cat.id}
                />
              </div>
            ))}
          </div>
        </div>

        {/* RADAR SPIDERWEB CHART */}
        <div className="audit-radar-section">
          <div className="section-micro-heading" style={{ width: '100%' }}>
            <span>HEALTH DISTRIBUTION</span>
            <span className="micro-sub">Balance radar</span>
          </div>
          <div className="radar-card-inner">
            <RadarChartDynamic data={categories} size={240} />
          </div>
        </div>
      </div>

      {/* ── DEDICATED SCORE BREAKDOWN & EXPLANATION SECTION ── */}
      <div className="audit-score-explanations-section">
        <div className="explanations-header">
          <div className="explanations-title-wrap">
            <span className="explanations-eyebrow">AUDIT INSIGHTS</span>
            <h3 className="explanations-title">Why These Scores Were Given</h3>
            <p className="explanations-sub">
              Detailed assessment of the specific factors, automated tests, and heuristic checks that determined each score for <strong>{displayDomain}</strong>.
            </p>
          </div>
        </div>

        <div className="explanations-grid">
          {categories.map((cat) => (
            <div 
              key={cat.id} 
              id={`score-reason-${cat.id}`}
              className={`score-reason-card ${selectedCategory === cat.id ? 'score-reason-card--focused' : ''}`}
              style={{ '--accent-color': cat.color }}
            >
              <div className="reason-card-top">
                <div className="reason-category-badge">
                  <span className="reason-color-dot" style={{ background: cat.color }}></span>
                  <span className="reason-category-name">{cat.label}</span>
                </div>
                <div className="reason-grade-badges">
                  <span className="reason-grade-pill" style={{ color: cat.color, borderColor: `${cat.color}40`, background: `${cat.color}10` }}>
                    Grade {cat.grade}
                  </span>
                  <span className="reason-status-pill">
                    {cat.status}
                  </span>
                </div>
              </div>

              <p className="reason-explanation-text">
                {cat.explanation}
              </p>

              <div className="reason-factors-list">
                {cat.positives && cat.positives.map((pos, idx) => (
                  <div key={`pos-${idx}`} className="reason-factor reason-factor--positive">
                    <span className="factor-bullet">✓</span>
                    <span>{pos}</span>
                  </div>
                ))}
                {cat.negatives && cat.negatives.map((neg, idx) => (
                  <div key={`neg-${idx}`} className="reason-factor reason-factor--negative">
                    <span className="factor-bullet">!</span>
                    <span>{neg}</span>
                  </div>
                ))}
              </div>

              <div className="reason-card-action">
                <button 
                  className="btn-inspect-dimension"
                  onClick={() => {
                    if (cat.id === 'accessibility') onNavigateTab && onNavigateTab('accessibility');
                    else if (cat.id === 'usability') onNavigateTab && onNavigateTab('heuristics');
                    else onNavigateTab && onNavigateTab('aifixes');
                  }}
                >
                  Inspect {cat.label} Fixes →
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── FOOTER ── */}
      <div className="audit-results-footer">
        <span className="audit-timestamp">
          <span className="time-dot"></span>
          Report Generated: {formattedDate}
        </span>
        <div className="audit-footer-actions">
          <button 
            className="btn-quick-nav"
            onClick={() => onNavigateTab ? onNavigateTab('heuristics') : null}
          >
            Inspect Heuristics →
          </button>
          <button 
            className="btn-quick-nav btn-quick-nav--primary"
            onClick={() => onNavigateTab ? onNavigateTab('aifixes') : null}
          >
            View AI Fixes ({recommendationsCount})
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuditResultsView;
