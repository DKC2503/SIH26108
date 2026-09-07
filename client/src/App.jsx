import React, { useState, useEffect, useRef } from 'react';
import Header from './components/layout/Header';
import Recommendations from './pages/Recommendations';
import SystemStatusModal from './components/status/SystemStatusModal';
import StandardsCompareModal from './components/compare/StandardsCompareModal';
import { checkSystemHealth, analyzeRequirement, analyzeTenderDocument } from './services/api';

export default function App() {
  const [systemStatus, setSystemStatus] = useState(null);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isCompareOpen, setIsCompareOpen] = useState(false);

  // Recommendations / Search state
  const [analysisData, setAnalysisData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeStandard, setActiveStandard] = useState(null);
  const [comparedStandards, setComparedStandards] = useState([]);
  const [savedStandards, setSavedStandards] = useState([]);

  // Hidden global file input for header "+ Add document" button
  const headerFileInputRef = useRef(null);

  // Initial health check
  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchHealth = async () => {
    const data = await checkSystemHealth();
    setSystemStatus(data);
  };

  const [errorMessage, setErrorMessage] = useState(null);

  const handleAnalyze = async (query, inputType = 'product_description', enableBis = true) => {
    setIsLoading(true);
    setErrorMessage(null);
    if (typeof query === 'string') {
      setSearchQuery(query);
    } else if (query?.name) {
      setSearchQuery(query.name);
    }
    
    try {
      if (query instanceof File || (query && typeof query === 'object' && query.name && inputType === 'tender_document')) {
        const tenderRes = await analyzeTenderDocument(query);
        const mergedData = {
          ...(tenderRes.recommendation_data || {}),
          tender_analysis: tenderRes.tender_analysis || null
        };
        setAnalysisData(mergedData);
      } else {
        const result = await analyzeRequirement(query, inputType, enableBis);
        setAnalysisData(result);
      }
    } catch (err) {
      console.error("Search execution error:", err);
      setErrorMessage(err.message || "Failed to retrieve standards from BIS.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearAnalysis = () => {
    setAnalysisData(null);
    setActiveStandard(null);
    setSearchQuery('');
    setErrorMessage(null);
  };

  const handleHeaderUploadClick = () => {
    if (headerFileInputRef.current) {
      headerFileInputRef.current.click();
    }
  };

  const handleHeaderFileSelected = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      handleAnalyze(file, 'tender_document', true);
    }
  };

  const handleToggleCompare = (standard) => {
    setComparedStandards(prev => {
      const exists = prev.some(s => s.is_number === standard.is_number);
      if (exists) {
        return prev.filter(s => s.is_number !== standard.is_number);
      }
      if (prev.length >= 4) {
        alert("You can compare up to 4 standards simultaneously.");
        return prev;
      }
      return [...prev, standard];
    });
  };

  const handleToggleSave = (standard) => {
    setSavedStandards(prev => {
      const exists = prev.some(s => s.is_number === standard.is_number);
      if (exists) {
        return prev.filter(s => s.is_number !== standard.is_number);
      }
      return [...prev, standard];
    });
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-body)', display: 'flex', flexDirection: 'column' }}>
      {/* Hidden File Input for Header "+ Add document" */}
      <input
        ref={headerFileInputRef}
        type="file"
        accept=".pdf,.docx,.txt"
        onChange={handleHeaderFileSelected}
        style={{ display: 'none' }}
      />

      {/* Global Minimal Search Engine Header */}
      <Header
        query={searchQuery}
        setQuery={setSearchQuery}
        onSearch={() => handleAnalyze(searchQuery, 'product_description', true)}
        onClear={handleClearAnalysis}
        hasResults={Boolean(analysisData && !isLoading)}
        isLoading={isLoading}
        systemStatus={systemStatus}
        onOpenStatusModal={() => setIsStatusOpen(true)}
        onUploadClick={handleHeaderUploadClick}
      />

      {/* Main Search Engine Workspace */}
      <main style={{ flex: 1 }}>
        <Recommendations
          analysisData={analysisData}
          isLoading={isLoading}
          errorMessage={errorMessage}
          onAnalyze={handleAnalyze}
          onClear={handleClearAnalysis}
          activeStandard={activeStandard}
          setActiveStandard={setActiveStandard}
          comparedStandards={comparedStandards}
          onToggleCompare={handleToggleCompare}
          savedStandards={savedStandards}
          onToggleSave={handleToggleSave}
        />
      </main>

      {/* Minimal Footer */}
      <footer style={{
        borderTop: '1px solid var(--border-subtle)',
        background: '#FFFFFF',
        padding: '14px 24px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        fontSize: '12px',
        color: 'var(--text-muted)'
      }}>
        <div>
          <span>ISRA • Indian Standards Retrieval Architecture</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {comparedStandards.length > 0 && (
            <button
              onClick={() => setIsCompareOpen(true)}
              style={{ color: 'var(--primary-blue)', fontWeight: 600 }}
            >
              Compare Standards ({comparedStandards.length})
            </button>
          )}
          <a
            href="https://standards.bis.gov.in/website"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--text-secondary)' }}
          >
            Official BIS Portal ↗
          </a>
        </div>
      </footer>

      {/* System Status Modal */}
      <SystemStatusModal
        isOpen={isStatusOpen}
        onClose={() => setIsStatusOpen(false)}
        status={systemStatus}
        onRefresh={fetchHealth}
      />

      {/* Standards Compare Modal */}
      <StandardsCompareModal
        isOpen={isCompareOpen}
        onClose={() => setIsCompareOpen(false)}
        standards={comparedStandards}
        onRemoveStandard={(isNum) => setComparedStandards(prev => prev.filter(s => s.is_number !== isNum))}
        onViewDetails={(s) => { setIsCompareOpen(false); setActiveStandard(s); }}
      />
    </div>
  );
}
