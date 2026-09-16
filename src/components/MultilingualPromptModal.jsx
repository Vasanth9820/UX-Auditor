import React, { useEffect, useState } from 'react';
import { startMultilingualAudit } from '../services/cicaadaApi';

const LANGUAGE_META = {
  hi: { flag: '🇮🇳', label: 'Hindi', native: 'हिन्दी', desc: 'Devanagari script UI & text expansion' },
  mr: { flag: '🇮🇳', label: 'Marathi', native: 'मराठी', desc: 'Regional Marathi UX & typography' },
  ta: { flag: '🇮🇳', label: 'Tamil', native: 'தமிழ்', desc: 'Dravidian Tamil script & accessibility' },
};

export default function MultilingualPromptModal({
  isOpen,
  parentAuditId,
  detectedLanguages = [],
  onProceed,
  onSkip,
}) {
  const validLanguages = detectedLanguages.filter(d => d.lang && d.lang !== 'en');

  const [selected, setSelected] = useState(() => validLanguages.map(d => d.lang));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setSelected(detectedLanguages.filter(d => d.lang && d.lang !== 'en').map(d => d.lang));
    setError(null);
  }, [detectedLanguages]);

  if (!isOpen || validLanguages.length === 0) return null;

  const toggleLang = (lang) => {
    setSelected(prev =>
      prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang]
    );
  };

  const selectAll = () => {
    if (selected.length === validLanguages.length) {
      setSelected([]);
    } else {
      setSelected(validLanguages.map(d => d.lang));
    }
  };

  const handleAudit = async () => {
    if (selected.length === 0) return;
    setLoading(true);
    setError(null);

    try {
      const res = await startMultilingualAudit(parentAuditId, selected);
      if (onProceed) {
        onProceed(selected, res.started);
      }
    } catch (err) {
      console.error('Failed to trigger multilingual audits:', err);
      setError(err.message || 'Failed to start multilingual audits');
      setLoading(false);
    }
  };

  const languageNamesString = validLanguages
    .map(d => LANGUAGE_META[d.lang]?.label || d.label)
    .join(', ');

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      animation: 'fadeIn 0.2s ease-out',
    }}>
      <div style={{
        width: '540px',
        maxWidth: '92vw',
        background: '#1e293b',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: '16px',
        padding: '28px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
        color: '#f8fafc',
        position: 'relative',
      }}>
        {/* Header Icon & Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '20px',
            flexShrink: 0,
          }}>
            🌐
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '19px', fontWeight: '700', color: '#fff' }}>
              Multilingual Support Detected
            </h3>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>
              Native Indic language switchers detected on target site
            </span>
          </div>
        </div>

        {/* Prompt Question */}
        <div style={{
          background: 'rgba(59, 130, 246, 0.08)',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          borderRadius: '10px',
          padding: '14px 16px',
          marginBottom: '20px',
          fontSize: '14px',
          lineHeight: '1.5',
          color: '#e2e8f0',
        }}>
          This website supports <strong>{languageNamesString}</strong>. Would you like to audit any of these languages?
        </div>

        {/* Checkbox Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '22px' }}>
          {validLanguages.map((item) => {
            const meta = LANGUAGE_META[item.lang] || { flag: '🌐', label: item.label, native: item.nativeName, desc: '' };
            const isChecked = selected.includes(item.lang);

            return (
              <label
                key={item.lang}
                onClick={() => toggleLang(item.lang)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  background: isChecked ? 'rgba(59, 130, 246, 0.14)' : 'rgba(255, 255, 255, 0.03)',
                  border: isChecked ? '1px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.08)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  userSelect: 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}}
                    style={{
                      width: '18px',
                      height: '18px',
                      cursor: 'pointer',
                      accentColor: '#3b82f6',
                    }}
                  />
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>{meta.flag}</span>
                      <span>{meta.label}</span>
                      <span style={{ color: '#38bdf8', fontSize: '13px' }}>({meta.native})</span>
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '2px' }}>
                      {meta.desc}
                    </div>
                  </div>
                </div>
                <span style={{
                  fontSize: '11px',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  color: '#cbd5e1',
                  fontFamily: 'monospace',
                }}>
                  {item.switchMethod === 'url' ? 'Route' : item.switchMethod.toUpperCase()}
                </span>
              </label>
            );
          })}
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid #ef4444',
            borderRadius: '8px',
            padding: '10px',
            color: '#f87171',
            fontSize: '13px',
            marginBottom: '16px',
          }}>
            {error}
          </div>
        )}

        {/* Modal Actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            type="button"
            onClick={selectAll}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              fontSize: '12.5px',
              cursor: 'pointer',
              textDecoration: 'underline',
              padding: 0,
            }}
          >
            {selected.length === validLanguages.length ? 'Deselect All' : 'Select All'}
          </button>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={onSkip}
              disabled={loading}
              className="btn btn-secondary"
              style={{
                padding: '9px 16px',
                fontSize: '13px',
                borderRadius: '8px',
                cursor: 'pointer',
              }}
            >
              Skip / View English
            </button>
            <button
              type="button"
              onClick={handleAudit}
              disabled={loading || selected.length === 0}
              className="btn btn-primary"
              style={{
                padding: '9px 20px',
                fontSize: '13px',
                borderRadius: '8px',
                cursor: selected.length === 0 ? 'not-allowed' : 'pointer',
                opacity: selected.length === 0 ? 0.6 : 1,
                background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                color: '#fff',
                border: 'none',
                fontWeight: '600',
              }}
            >
              {loading ? 'Starting Audits...' : `Audit Selected (${selected.length})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
