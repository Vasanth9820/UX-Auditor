import { useState, useEffect, useRef } from 'react';
import { startAudit, fetchAudit, connectAuditSocket } from '../services/cicaadaApi';
import MultilingualPromptModal from './MultilingualPromptModal';

const AuditModal = ({ isOpen, targetUrl, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isClosing, setIsClosing] = useState(false);
  const [logs, setLogs] = useState([]);
  const [auditId, setAuditId] = useState(null);
  const [detectedLanguages, setDetectedLanguages] = useState([]);
  const [showMultilingualPrompt, setShowMultilingualPrompt] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    let active = true;

    if (isOpen && targetUrl) {
      setCurrentStep(0);
      setIsClosing(false);
      setLogs(['> Initializing engine...']);
      setAuditId(null);
      setDetectedLanguages([]);
      setShowMultilingualPrompt(false);

      const runAudit = async () => {
        try {
          const res = await startAudit(targetUrl);
          if (!active) return;
          
          setAuditId(res.auditId);
          setLogs(prev => [...prev, '> Audit started. ID: ' + res.auditId]);
        } catch (error) {
          if (!active) return;
          setLogs(prev => [...prev, '> Error: ' + error.message]);
        }
      };
      
      runAudit();
    }
    
    return () => {
      active = false;
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [isOpen, targetUrl]);

  useEffect(() => {
    if (!auditId) return;

    socketRef.current = connectAuditSocket(
      auditId,
      (progress) => {
        // progress is { step: number, message: string, percent: number }
        const stepMap = {
          extract: 1,
          analyze: 2,
          simulate: 3,
          report: 5,
          complete: 6
        };
        const mappedStep = stepMap[progress.step] || 0;
        if (mappedStep > currentStep) {
          setCurrentStep(mappedStep);
        }
        
        setLogs(prev => [...prev, '> ' + progress.message]);
      },
      async () => {
        setCurrentStep(6);
        setLogs(prev => [...prev, '> Audit complete. Preparing report...']);
        
        try {
          const report = await fetchAudit(auditId);
          const detected = (report.detectedLanguages || report.pageData?.detectedLanguages || [])
            .filter(d => d.lang && d.lang !== 'en');

          if (detected.length > 0) {
            setDetectedLanguages(detected);
            setShowMultilingualPrompt(true);
            setLogs(prev => [...prev, `> Detected Indic languages: ${detected.map(d => d.label).join(', ')}`]);
            return;
          }
        } catch (e) {
          console.warn('Could not check detected languages:', e);
        }

        // Default redirect to dashboard
        setTimeout(() => {
          window.location.href = `/?page=dashboard&auditId=${auditId}`;
        }, 1500);
      },
      (err) => {
        setLogs(prev => [...prev, '> Error: ' + err]);
      }
    );

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [auditId]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
      setCurrentStep(0);
      setLogs([]);
    }, 400); // Wait for fade-out animation
  };

  if (!isOpen && !isClosing) return null;

  return (
    <div className={`audit-modal ${isOpen && !isClosing ? 'open' : ''}`} id="auditModal">
      <div className="audit-modal__content">
        <div className="audit-modal__close" onClick={handleClose}>×</div>
        
        <div className="audit-modal__header">
          <span className="section__overline">End-to-End Pipeline</span>
          <h2 className="audit-modal__title">From URL to <span className="text-gradient">Verified Fixes</span></h2>
          <p className="audit-modal__desc">A fully automated pipeline scanning <span className="font-mono text-indigo">{targetUrl}</span></p>
        </div>

        <div className="workflow__pipeline audit-modal__pipeline">
          {/* Step 1 */}
          <div className={`workflow__step ${currentStep >= 1 ? 'active' : ''} ${currentStep > 1 ? 'completed' : ''}`}>
            <div className="workflow__step-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            </div>
            <span className="workflow__step-label">Browser Scan</span>
          </div>
          <div className="workflow__connector"><div className="workflow__connector-line" style={{ transform: `scaleX(${currentStep > 1 ? 1 : 0})` }}></div></div>
          
          {/* Step 2 */}
          <div className={`workflow__step ${currentStep >= 2 ? 'active' : ''} ${currentStep > 2 ? 'completed' : ''}`}>
            <div className="workflow__step-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            </div>
            <span className="workflow__step-label">Data Extract</span>
          </div>
          <div className="workflow__connector"><div className="workflow__connector-line" style={{ transform: `scaleX(${currentStep > 2 ? 1 : 0})` }}></div></div>
          
          {/* Step 3 */}
          <div className={`workflow__step ${currentStep >= 3 ? 'active' : ''} ${currentStep > 3 ? 'completed' : ''}`}>
            <div className="workflow__step-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            </div>
            <span className="workflow__step-label">WCAG + UX</span>
          </div>
          <div className="workflow__connector"><div className="workflow__connector-line" style={{ transform: `scaleX(${currentStep > 3 ? 1 : 0})` }}></div></div>
          
          {/* Step 4 */}
          <div className={`workflow__step ${currentStep >= 4 ? 'active' : ''} ${currentStep > 4 ? 'completed' : ''}`}>
            <div className="workflow__step-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <span className="workflow__step-label">Journeys</span>
          </div>
          <div className="workflow__connector"><div className="workflow__connector-line" style={{ transform: `scaleX(${currentStep > 4 ? 1 : 0})` }}></div></div>
          
          {/* Step 5 */}
          <div className={`workflow__step ${currentStep >= 5 ? 'active' : ''} ${currentStep > 5 ? 'completed' : ''}`}>
            <div className="workflow__step-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            </div>
            <span className="workflow__step-label">AI Fixes</span>
          </div>
          <div className="workflow__connector"><div className="workflow__connector-line" style={{ transform: `scaleX(${currentStep > 5 ? 1 : 0})` }}></div></div>
          
          {/* Step 6 */}
          <div className={`workflow__step ${currentStep >= 6 ? 'active' : ''} ${currentStep > 6 ? 'completed' : ''}`}>
            <div className="workflow__step-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <span className="workflow__step-label">Verified</span>
          </div>
        </div>
        
        <div className="audit-modal__progress-container" style={{ marginBottom: '24px' }}>
          <div 
            className="audit-modal__progress-bar" 
            style={{ width: `${(Math.min(currentStep, 6) / 6) * 100}%` }}
          ></div>
        </div>
        
        <div style={{ background: '#0f172a', borderRadius: '8px', padding: '16px', fontFamily: 'monospace', fontSize: '13px', color: '#10b981', textAlign: 'left', height: '140px', overflowY: 'auto', border: '1px solid #1e293b', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column' }}>
          {logs.map((log, i) => (
            <div key={i}>{log}</div>
          ))}
          <div style={{ display: 'inline-block', width: '8px', height: '14px', background: '#10b981', marginTop: '4px', opacity: currentStep >= 6 ? 0 : 1 }}></div>
        </div>
      </div>

      <MultilingualPromptModal
        isOpen={showMultilingualPrompt}
        parentAuditId={auditId}
        detectedLanguages={detectedLanguages}
        onProceed={() => {
          setShowMultilingualPrompt(false);
          window.location.href = `/?page=dashboard&auditId=${auditId}&multilingual=true`;
        }}
        onSkip={() => {
          setShowMultilingualPrompt(false);
          window.location.href = `/?page=dashboard&auditId=${auditId}`;
        }}
      />
    </div>
  );
};

export default AuditModal;
