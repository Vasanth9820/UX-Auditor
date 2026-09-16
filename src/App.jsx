import { useState, useEffect } from 'react';
import { SignedIn, SignedOut } from '@clerk/clerk-react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import AuditModal from './components/AuditModal';
import Dashboard from './components/DashboardReact';
import { Features, Engines } from './components/Sections';
import { WorkflowJourneys, BottomSections } from './components/MoreSections';
import './index.css';

function App() {
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [targetUrl, setTargetUrl] = useState('');

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          // Optional: observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });
    
    const observeElements = () => {
      document.querySelectorAll('.animate-in:not(.observed)').forEach(el => {
        el.classList.add('observed');
        observer.observe(el);
      });
    };

    observeElements();

    const mutationObserver = new MutationObserver(() => {
      observeElements();
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
    };
  }, []); // Re-run when view changes

  const handleStartAudit = (url = 'https://example.com') => {
    setTargetUrl(url);
    setIsAuditModalOpen(true);
  };

  return (
    <>
      {/* Animated background elements */}
      <div className="bg-grid" id="bgGrid"></div>
      <div className="bg-glow bg-glow--1"></div>
      <div className="bg-glow bg-glow--2"></div>
      <div className="bg-glow bg-glow--3"></div>

      {(() => {
        const isDashboardRoute = 
          window.location.pathname.startsWith('/dashboard') || 
          window.location.search.includes('page=') || 
          window.location.search.includes('auditId=') || 
          window.location.search.includes('repo=');

        return (
          <>
            <SignedIn>
              {isDashboardRoute ? (
                <Dashboard />
              ) : (
                <>
                  <Navbar onStartAudit={() => handleStartAudit()} />
                  <Hero onStartAudit={handleStartAudit} />
                  <Features />
                  <Engines />
                  <WorkflowJourneys />
                  <BottomSections />
                </>
              )}
            </SignedIn>
            
            <SignedOut>
              {isDashboardRoute ? (
                <Dashboard />
              ) : (
                <>
                  <Navbar onStartAudit={() => handleStartAudit()} />
                  <Hero onStartAudit={handleStartAudit} />
                  <Features />
                  <Engines />
                  <WorkflowJourneys />
                  <BottomSections />
                </>
              )}
            </SignedOut>
          </>
        );
      })()}
      
      <AuditModal 
        isOpen={isAuditModalOpen} 
        onClose={() => setIsAuditModalOpen(false)} 
        targetUrl={targetUrl} 
      />
    </>
  );
}

export default App;
