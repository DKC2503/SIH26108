import React, { useState, useEffect } from 'react';
import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import Recommendations from './pages/Recommendations';
import StandardsExplorer from './pages/StandardsExplorer';
import TenderAnalysis from './pages/TenderAnalysis';
import History from './pages/History';
import SystemStatusModal from './components/status/SystemStatusModal';
import StandardsCompareModal from './components/compare/StandardsCompareModal';
import { checkSystemHealth, analyzeRequirement } from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('recommendations'); // 'recommendations', 'tender', 'explorer', 'history'
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [systemStatus, setSystemStatus] = useState(null);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isCompareOpen, setIsCompareOpen] = useState(false);

  // Recommendations state
  const [analysisData, setAnalysisData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeStandard, setActiveStandard] = useState(null);
  const [comparedStandards, setComparedStandards] = useState([]);
  const [savedStandards, setSavedStandards] = useState([]);

  // Session history (stored in localStorage)
  const [historyItems, setHistoryItems] = useState(() => {
    try {
      const saved = localStorage.getItem('bisense_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Initial health check
  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 45000);
    return () => clearInterval(interval);
  }, []);

  // Save history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('bisense_history', JSON.stringify(historyItems));
    } catch (_) {}
  }, [historyItems]);

  const fetchHealth = async () => {
    const data = await checkSystemHealth();
    setSystemStatus(data);
  };

  const handleAnalyze = async (query, inputType = 'product_description', enableBis = true) => {
    setIsLoading(true);
    try {
      const result = await analyzeRequirement(query, inputType, enableBis);
      setAnalysisData(result);
      setActiveTab('recommendations');

      // Log into history
      const totalFound = (result.primary_standards?.length || 0) + 
        Object.values(result.allied_standards || {}).reduce((acc, curr) => acc + (Array.isArray(curr) ? curr.length : 0), 0);

      const historyRecord = {
        id: Date.now(),
        query: typeof query === 'string' ? query : query.name || "Tender Document",
        product: result.requirement?.product || "Procurement Item",
        standardsCount: totalFound,
        status: result.status || "completed",
        timestamp: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        data: result
      };

      setHistoryItems(prev => [historyRecord, ...prev.slice(0, 19)]);
    } catch (err) {
      console.error("Analysis execution error:", err);
      alert(`Analysis failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearAnalysis = () => {
    setAnalysisData(null);
    setActiveStandard(null);
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

  const handleOpenHistoryItem = (item) => {
    if (item.data) {
      setAnalysisData(item.data);
      setActiveTab('recommendations');
    } else if (item.query) {
      handleAnalyze(item.query, 'product_description', true);
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        onOpenStatusModal={() => setIsStatusOpen(true)}
        onOpenCompareModal={() => setIsCompareOpen(true)}
      />

      {/* Main Workspace Layout */}
      <div className="main-content">
        {/* Global Application Header */}
        <Header
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          systemStatus={systemStatus}
          onOpenStatusModal={() => setIsStatusOpen(true)}
        />

        {/* Dynamic Workspace Content */}
        {activeTab === 'recommendations' && (
          <Recommendations
            analysisData={analysisData}
            isLoading={isLoading}
            onAnalyze={handleAnalyze}
            onClear={handleClearAnalysis}
            activeStandard={activeStandard}
            setActiveStandard={setActiveStandard}
            comparedStandards={comparedStandards}
            onToggleCompare={handleToggleCompare}
            savedStandards={savedStandards}
            onToggleSave={handleToggleSave}
          />
        )}

        {activeTab === 'explorer' && (
          <StandardsExplorer
            onViewDetails={setActiveStandard}
            onToggleCompare={handleToggleCompare}
            comparedStandards={comparedStandards}
          />
        )}

        {activeTab === 'tender' && (
          <TenderAnalysis
            onViewDetails={setActiveStandard}
          />
        )}

        {activeTab === 'history' && (
          <History
            historyItems={historyItems}
            onOpenHistoryItem={handleOpenHistoryItem}
            onClearHistory={() => setHistoryItems([])}
          />
        )}
      </div>

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
