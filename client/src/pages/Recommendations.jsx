import React, { useState, useRef } from 'react';
import { 
  Search, 
  X, 
  Upload, 
  FileText, 
  Sparkles, 
  Filter, 
  ArrowUpDown, 
  Layers, 
  CheckCircle2, 
  AlertCircle,
  FileCheck,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import RecommendationCard from '../components/recommendations/RecommendationCard';
import StandardDetailsDrawer from '../components/recommendations/StandardDetailsDrawer';

export default function Recommendations({
  analysisData,
  isLoading,
  onAnalyze,
  onClear,
  activeStandard,
  setActiveStandard,
  comparedStandards = [],
  onToggleCompare,
  savedStandards = [],
  onToggleSave
}) {
  const [searchInput, setSearchInput] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [filterType, setFilterType] = useState('all'); // 'all', 'primary', 'allied', 'verified'
  const [sortBy, setSortBy] = useState('relevance'); // 'relevance', 'is_number'
  const [showTenderSummary, setShowTenderSummary] = useState(true);
  const fileInputRef = useRef(null);

  const requirement = analysisData?.requirement || null;
  const primaryStandards = analysisData?.primary_standards || [];
  
  // Flatten allied standards
  const alliedObj = analysisData?.allied_standards || {};
  const alliedStandards = [
    ...(alliedObj.test_methods || []),
    ...(alliedObj.safety || []),
    ...(alliedObj.installation || []),
    ...(alliedObj.terminology || []),
    ...(alliedObj.cross_references || []),
    ...(alliedObj.related_products || [])
  ];

  const totalResultsCount = primaryStandards.length + alliedStandards.length;
  const hasResults = Boolean(analysisData && totalResultsCount > 0);
  const isZeroResults = Boolean(analysisData && totalResultsCount === 0 && !isLoading);

  // Filter logic
  let displayPrimary = [...primaryStandards];
  let displayAllied = [...alliedStandards];

  if (filterType === 'primary') {
    displayAllied = [];
  } else if (filterType === 'allied') {
    displayPrimary = [];
  } else if (filterType === 'verified') {
    displayPrimary = displayPrimary.filter(s => 
      s.verification_source === 'official_bis_live' || 
      s.verification_source === 'official_bis_cache' ||
      s.data_source === 'BIS_LIVE' ||
      s.data_source === 'LOCAL_KNOWLEDGE_BASE'
    );
    displayAllied = displayAllied.filter(s => 
      s.verification_source === 'official_bis_live' || 
      s.verification_source === 'official_bis_cache' ||
      s.data_source === 'BIS_LIVE' ||
      s.data_source === 'LOCAL_KNOWLEDGE_BASE'
    );
  }

  // Sort logic
  const sortFn = (a, b) => {
    if (sortBy === 'relevance') {
      return (b.score || 0) - (a.score || 0);
    }
    if (sortBy === 'is_number') {
      return (a.is_number || '').localeCompare(b.is_number || '');
    }
    return 0;
  };

  displayPrimary.sort(sortFn);
  displayAllied.sort(sortFn);

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    if (selectedFile) {
      onAnalyze(selectedFile, 'tender_document', true);
      return;
    }
    if (!searchInput.trim()) return;
    onAnalyze(searchInput.trim(), 'product_description', true);
  };

  const handleChipClick = (term) => {
    setSearchInput(term);
    setSelectedFile(null);
    onAnalyze(term, 'product_description', true);
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Canonical procurement example chips
  const searchChips = [
    { label: "LED street lighting", query: "LED street lighting luminaires IP66" },
    { label: "Portland cement", query: "Ordinary Portland Cement 43 grade" },
    { label: "High tensile rebars", query: "High strength deformed steel bars Fe 500D" },
    { label: "Safety helmets", query: "Industrial safety helmets for construction" },
    { label: "IS 10322", query: "IS 10322" },
    { label: "Ball point pen", query: "Ball point pens and refills" }
  ];

  // ============================================================
  // VIEW 1: LOADING STATE
  // ============================================================
  if (isLoading) {
    return (
      <div style={{
        minHeight: 'calc(100vh - 140px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
        textAlign: 'center'
      }}>
        <div className="spinner-minimal" style={{ marginBottom: '20px' }} />
        <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
          Searching BIS standards...
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', maxWidth: '440px' }}>
          Querying Bureau of Indian Standards live portal (standards.bis.gov.in) and verified standards index.
        </p>
      </div>
    );
  }

  // ============================================================
  // VIEW 2: HOMEPAGE (CLEAN GOOGLE / BING SEARCH ENGINE STYLE)
  // ============================================================
  if (!analysisData) {
    return (
      <div style={{
        minHeight: 'calc(100vh - 120px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px 20px 60px 20px'
      }}>
        {/* Centered Brand Title */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '8px'
          }}>
            <h1 style={{
              fontSize: '44px',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              color: 'var(--text-main)',
              lineHeight: 1
            }}>
              BISense
            </h1>
            <span style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '4px',
              background: '#EFF6FF',
              color: 'var(--primary-blue)',
              border: '1px solid #BFDBFE',
              letterSpacing: '0.04em'
            }}>
              SIH 2026
            </span>
          </div>
          <p style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>
            AI Procurement Standards Assistant • Indian Standards Intelligence
          </p>
        </div>

        {/* Dominant Search Input Box */}
        <div style={{ width: '100%', maxWidth: '680px', marginBottom: '20px' }}>
          <form onSubmit={handleSearchSubmit} className="search-bar-dominant">
            <Search size={20} color="var(--text-muted)" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search Indian Standards by product, requirement, or IS number..."
              autoFocus
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                style={{ padding: '4px', color: 'var(--text-muted)' }}
                title="Clear query"
              >
                <X size={16} />
              </button>
            )}
            <button
              type="submit"
              disabled={!searchInput.trim() && !selectedFile}
              className="btn btn-primary"
              style={{ borderRadius: '20px', padding: '8px 20px' }}
            >
              Search
            </button>
          </form>
        </div>

        {/* Selected File Notice (if user attached a document) */}
        {selectedFile && (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '10px',
            padding: '8px 16px',
            background: '#EFF6FF',
            border: '1px solid #BFDBFE',
            borderRadius: '20px',
            marginBottom: '20px',
            fontSize: '13px',
            color: 'var(--primary-blue)'
          }}>
            <FileText size={15} />
            <span>Attached: <strong>{selectedFile.name}</strong> ({(selectedFile.size / 1024).toFixed(1)} KB)</span>
            <button
              type="button"
              onClick={clearSelectedFile}
              style={{ color: 'var(--text-muted)', marginLeft: '4px' }}
              title="Remove file"
            >
              <X size={14} />
            </button>
            <button
              type="button"
              onClick={handleSearchSubmit}
              className="btn btn-primary btn-sm"
              style={{ marginLeft: '6px', borderRadius: '12px' }}
            >
              Analyze Document →
            </button>
          </div>
        )}

        {/* Minimal Add Document Action */}
        {!selectedFile && (
          <div style={{ marginBottom: '28px' }}>
            <label style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '20px',
              background: '#FFFFFF',
              border: '1px dashed #CBD5E1',
              fontSize: '13px',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}>
              <Upload size={14} color="var(--primary-blue)" />
              <span>+ Add tender or specification document (PDF, DOCX, TXT)</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        )}

        {/* Canonical Suggestions Chips */}
        <div style={{ textAlign: 'center', maxWidth: '680px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '10px' }}>
            Try searching for
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px' }}>
            {searchChips.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleChipClick(chip.query)}
                className="search-chip"
              >
                <Sparkles size={12} color="var(--status-gold)" />
                <span>{chip.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // VIEW 3: SEARCH RESULTS PAGE
  // ============================================================
  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '24px 20px 60px 20px' }}>
      {/* Search Header Info Bar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        marginBottom: '16px',
        paddingBottom: '14px',
        borderBottom: '1px solid var(--border-subtle)'
      }}>
        <div>
          <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
            About {totalResultsCount} results {analysisData.timings?.total ? `(${analysisData.timings.total}s)` : ''}
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-main)', marginTop: '2px' }}>
            Indian Standards for "{requirement?.product || searchInput || 'Requirement'}"
          </h2>
        </div>

        {/* Filter Pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => setFilterType('all')}
            className={`btn btn-sm ${filterType === 'all' ? 'btn-primary' : 'btn-secondary'}`}
          >
            All ({totalResultsCount})
          </button>
          <button
            onClick={() => setFilterType('primary')}
            className={`btn btn-sm ${filterType === 'primary' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Primary ({primaryStandards.length})
          </button>
          <button
            onClick={() => setFilterType('allied')}
            className={`btn btn-sm ${filterType === 'allied' ? 'btn-primary' : 'btn-secondary'}`}
          >
            Allied ({alliedStandards.length})
          </button>
          <button
            onClick={() => setFilterType('verified')}
            className={`btn btn-sm ${filterType === 'verified' ? 'btn-primary' : 'btn-secondary'}`}
          >
            BIS Verified
          </button>

          {/* Sort Dropdown */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginLeft: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
            <ArrowUpDown size={12} />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{
                background: '#FFFFFF',
                border: '1px solid var(--border-subtle)',
                borderRadius: '4px',
                padding: '4px 8px',
                fontSize: '12px',
                color: 'var(--text-main)'
              }}
            >
              <option value="relevance">Relevance</option>
              <option value="is_number">IS Number</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tender Requirement Extraction Box (if applicable) */}
      {requirement && (requirement.technical_specs || requirement.parameters || requirement.scope) && (
        <div style={{
          background: '#F8FAFC',
          border: '1px solid var(--border-subtle)',
          borderRadius: '8px',
          padding: '14px 18px',
          marginBottom: '20px'
        }}>
          <div 
            onClick={() => setShowTenderSummary(prev => !prev)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileCheck size={16} color="var(--primary-blue)" />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                Extracted Requirement Profile: {requirement.product || "Procurement Item"}
              </span>
            </div>
            {showTenderSummary ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
          </div>

          {showTenderSummary && (
            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
              {requirement.scope && (
                <div style={{ marginBottom: '6px' }}>
                  <strong>Scope:</strong> {requirement.scope}
                </div>
              )}
              {requirement.technical_specs && Object.keys(requirement.technical_specs).length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
                  {Object.entries(requirement.technical_specs).map(([k, v], idx) => (
                    <span key={idx} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', padding: '2px 8px', borderRadius: '4px' }}>
                      <strong>{k}:</strong> {String(v)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Zero Results Notice */}
      {isZeroResults && (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          background: '#FFFFFF',
          border: '1px solid var(--border-subtle)',
          borderRadius: '8px'
        }}>
          <AlertCircle size={36} color="var(--status-gold)" style={{ margin: '0 auto 12px auto' }} />
          <h3 style={{ fontSize: '17px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
            No Indian Standards Found
          </h3>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)', maxWidth: '480px', margin: '0 auto 16px auto' }}>
            No matching standards were identified for "{requirement?.product || searchInput}". Try broader keywords, search directly by IS number, or check spelling.
          </p>
          <button
            onClick={() => {
              onClear();
              setSearchInput('');
            }}
            className="btn btn-secondary btn-sm"
          >
            Clear Search & Try Again
          </button>
        </div>
      )}

      {/* Results List */}
      {totalResultsCount > 0 && (
        <div>
          {/* Primary Standards Section */}
          {displayPrimary.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{
                fontSize: '12px',
                fontWeight: 700,
                color: 'var(--primary-blue)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <span>Primary Specifications ({displayPrimary.length})</span>
              </div>
              {displayPrimary.map((std, idx) => (
                <RecommendationCard
                  key={`primary-${std.is_number}-${idx}`}
                  standard={std}
                  isPrimary={true}
                  onViewDetails={setActiveStandard}
                  onToggleCompare={onToggleCompare}
                  isCompared={comparedStandards.some(s => s.is_number === std.is_number)}
                  onSave={onToggleSave}
                  isSaved={savedStandards.some(s => s.is_number === std.is_number)}
                />
              ))}
            </div>
          )}

          {/* Allied / Supporting Standards Section */}
          {displayAllied.length > 0 && (
            <div>
              <div style={{
                fontSize: '12px',
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <span>Allied & Test Method Standards ({displayAllied.length})</span>
              </div>
              {displayAllied.map((std, idx) => (
                <RecommendationCard
                  key={`allied-${std.is_number}-${idx}`}
                  standard={std}
                  isPrimary={false}
                  onViewDetails={setActiveStandard}
                  onToggleCompare={onToggleCompare}
                  isCompared={comparedStandards.some(s => s.is_number === std.is_number)}
                  onSave={onToggleSave}
                  isSaved={savedStandards.some(s => s.is_number === std.is_number)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Slide-over Standard Details Drawer */}
      <StandardDetailsDrawer
        standard={activeStandard}
        onClose={() => setActiveStandard(null)}
        onSelectStandard={(isNum) => {
          onAnalyze(isNum, 'is_number', true);
        }}
      />
    </div>
  );
}
