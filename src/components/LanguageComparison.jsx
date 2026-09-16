import React from 'react';

const LANGUAGE_CONFIG = {
  en: { label: 'English', native: 'English', flag: '🌐' },
  hi: { label: 'Hindi', native: 'हिन्दी', flag: '🇮🇳' },
  mr: { label: 'Marathi', native: 'मराठी', flag: '🇮🇳' },
  ta: { label: 'Tamil', native: 'தமிழ்', flag: '🇮🇳' },
};

export default function LanguageComparison({
  comparisonData = {},
  currentLang = 'en',
  onSelectLanguage,
  onAuditLanguage,
  detectedLanguages = [],
}) {
  const detectedKeys = detectedLanguages.map(language => language.lang).filter(Boolean);
  const languagesList = ['en', ...new Set([...Object.keys(comparisonData), ...detectedKeys])];

  // Filter list to languages present in comparisonData or detected on the site
  const activeLangs = languagesList.filter(
    l => l === 'en' || comparisonData[l] || detectedKeys.includes(l)
  );

  const getScoreColor = (score) => {
    if (score >= 85) return 'var(--green)';
    if (score >= 70) return 'var(--yellow)';
    return 'var(--red)';
  };

  const getGradeBadgeClass = (grade) => {
    if (['A', 'A+', 'A-'].includes(grade)) return 'badge-success';
    if (['B', 'B+', 'B-'].includes(grade)) return 'badge-info';
    if (['C', 'C+'].includes(grade)) return 'badge-warn';
    return 'badge-critical';
  };

  return (
    <div className="card" style={{ marginBottom: '24px', overflow: 'hidden' }}>
      <div className="section-h" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🌐 Multilingual Audit Comparison</span>
            <span className="badge badge-info" style={{ fontSize: '11px', textTransform: 'uppercase' }}>
              Indic Localization
            </span>
          </div>
          <div className="section-sub">
            Side-by-side UX, WCAG accessibility, and localization metrics across supported languages.
          </div>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="tbl" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(255, 255, 255, 0.02)' }}>
              <th style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-muted)' }}>Language</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-muted)' }}>Status</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-muted)' }}>Overall UX</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-muted)' }}>Grade</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-muted)' }}>Accessibility</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-muted)' }}>Heuristic UX</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-muted)' }}>Total Issues</th>
              <th style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-muted)', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {activeLangs.map((langKey) => {
              const info = comparisonData[langKey];
              const detected = detectedLanguages.find(language => language.lang === langKey);
              const cfg = LANGUAGE_CONFIG[langKey] || {
                label: detected?.label || langKey.toUpperCase(),
                native: detected?.nativeName || langKey,
                flag: '🌐',
              };
              const isSelected = currentLang === langKey;
              const isAudited = !!info && info.status === 'completed';
              const isRunning = !!info && info.status === 'running';

              return (
                <tr
                  key={langKey}
                  style={{
                    borderTop: '1px solid var(--border-light)',
                    background: isSelected ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                    transition: 'background 0.15s ease',
                  }}
                >
                  <td style={{ padding: '14px 16px', fontWeight: '600' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '18px' }}>{cfg.flag}</span>
                      <div>
                        <div style={{ color: isSelected ? 'var(--blue)' : 'var(--text-primary)', fontSize: '14px' }}>
                          {cfg.label}
                        </div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                          {cfg.native}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td style={{ padding: '14px 16px' }}>
                    {isAudited ? (
                      <span style={{
                        fontSize: '11.5px',
                        background: '#f0fdf4',
                        color: '#16a34a',
                        border: '1px solid #bbf7d0',
                        borderRadius: '4px',
                        padding: '2px 8px',
                        fontWeight: '600',
                      }}>
                        Audited ✓
                      </span>
                    ) : isRunning ? (
                      <div style={{ minWidth: '170px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '11.5px', color: '#2563eb', fontWeight: '600', marginBottom: '5px' }}>
                          <span>{info.progress?.message || 'Auditing...'}</span>
                          <span>{Math.round(info.progress?.percent || 0)}%</span>
                        </div>
                        <div style={{ height: '5px', background: '#dbeafe', borderRadius: '99px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, Math.max(0, info.progress?.percent || 0))}%`, height: '100%', background: '#2563eb', borderRadius: '99px', transition: 'width 0.3s ease' }} />
                        </div>
                      </div>
                    ) : (
                      <span style={{
                        fontSize: '11.5px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        color: 'var(--text-muted)',
                        borderRadius: '4px',
                        padding: '2px 8px',
                      }}>
                        Not Audited
                      </span>
                    )}
                  </td>

                  <td style={{ padding: '14px 16px' }}>
                    {isAudited ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          fontSize: '16px',
                          fontWeight: '800',
                          color: getScoreColor(info.score),
                        }}>
                          {info.score}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>/100</span>
                      </div>
                    ) : '—'}
                  </td>

                  <td style={{ padding: '14px 16px' }}>
                    {isAudited ? (
                      <span className={`badge ${getGradeBadgeClass(info.grade)}`} style={{ fontWeight: '700' }}>
                        {info.grade || 'B'}
                      </span>
                    ) : '—'}
                  </td>

                  <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: '600' }}>
                    {isAudited ? `${info.wcag || 0}%` : '—'}
                  </td>

                  <td style={{ padding: '14px 16px', fontSize: '13px', fontWeight: '600' }}>
                    {isAudited ? `${info.heuristic || 0}%` : '—'}
                  </td>

                  <td style={{ padding: '14px 16px' }}>
                    {isAudited ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: '700', fontSize: '14px', color: 'var(--text-primary)' }}>
                          {info.totalIssues || 0}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>issues</span>
                      </div>
                    ) : '—'}
                  </td>

                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    {isAudited ? (
                      <button
                        type="button"
                        onClick={() => onSelectLanguage && onSelectLanguage(langKey)}
                        className={`btn btn-xs ${isSelected ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '6px 14px', borderRadius: '6px', fontSize: '12px' }}
                      >
                        {isSelected ? 'Viewing' : 'View Report'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onAuditLanguage && onAuditLanguage(langKey)}
                        disabled={isRunning}
                        className="btn btn-primary btn-xs"
                        style={{ padding: '6px 14px', borderRadius: '6px', fontSize: '12px' }}
                      >
                        {isRunning ? 'Auditing…' : `Audit ${cfg.label}`}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
