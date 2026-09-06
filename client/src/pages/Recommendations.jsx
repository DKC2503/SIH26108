import React, { useState } from 'react';
import { 
  Filter, 
  ArrowUpDown, 
  Layers, 
  CheckCircle2, 
  FileText, 
  AlertCircle 
} from 'lucide-react';
import InputWorkspace from '../components/recommendations/InputWorkspace';
import RequirementProfile from '../components/recommendations/RequirementProfile';
import AnalysisTracker from '../components/recommendations/AnalysisTracker';
import RecommendationCard from '../components/recommendations/RecommendationCard';
import StandardDetailsDrawer from '../components/recommendations/StandardDetailsDrawer';
import ZeroResultsState from '../components/recommendations/ZeroResultsState';
import PartialResultsBanner from '../components/recommendations/PartialResultsBanner';

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
  const [filterType, setFilterType] = useState('all'); // 'all', 'primary', 'allied', 'verified'
  const [sortBy, setSortBy] = useState('relevance'); // 'relevance', 'is_number', 'year'

  const requirement = analysisData?.requirement || null;
  const primaryStandards = analysisData?.primary_standards || [];
  
  // Flatten allied standards object into array
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
  const isZeroResults = analysisData && totalResultsCount === 0;
  const isPartial = analysisData?.status === 'partial' || (analysisData?.bisStatus === 'unavailable' && totalResultsCount > 0);

  // Filter logic
  let displayPrimary = [...primaryStandards];
  let displayAllied = [...alliedStandards];

  if (filterType === 'primary') {
    displayAllied = [];
  } else if (filterType === 'allied') {
    displayPrimary = [];
  } else if (filterType === 'verified') {
    displayPrimary = displayPrimary.filter(s => ['live_verified', 'local_verified', 'verified'].includes(s.verification?.status) || s.verification_source === 'official_bis_live' || s.verification_source === 'official_bis_cache');
    displayAllied = displayAllied.filter(s => ['live_verified', 'local_verified', 'verified'].includes(s.verification?.status) || s.verification_source === 'official_bis_live' || s.verification_source === 'official_bis_cache');
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

  return (
    <div className="page-body">
      {/* Top Breadcrumb & Title */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '4px' }}>
          Workspace / Recommendations
        </div>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#FFFFFF' }}>
          Find Applicable Indian Standards
        </h1>
        <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
          Translate procurement requirements into relevant Indian Standards, technical specifications, and compliance considerations.
        </p>
      </div>

      {/* Input Panel */}
      <InputWorkspace
        onAnalyze={onAnalyze}
        isLoading={isLoading}
        onClear={onClear}
        initialQuery={requirement?.product || ""}
      />

      {/* Analysis Stages Tracker */}
      {analysisData && (
        <AnalysisTracker
          stages={analysisData.stages || []}
          timings={analysisData.timings || {}}
          bisStatus={analysisData.run_meta?.bis_status || analysisData.bisStatus}
        />
      )}

      {/* Requirement Profile */}
      {requirement && (
        <RequirementProfile requirement={requirement} />
      )}

      {/* Partial Results Banner */}
      {isPartial && (
        <PartialResultsBanner localCount={totalResultsCount} />
      )}

      {/* Zero Results Notice */}
      {isZeroResults && (
        <ZeroResultsState
          query={requirement?.product || "Query"}
          bisStatus={analysisData?.bisStatus}
          onTriggerBisSearch={() => onAnalyze(requirement?.product, 'product_description', true)}
          isLoading={isLoading}
        />
      )}

      {/* Results Header Toolbar (if results exist) */}
      {totalResultsCount > 0 && (
        <div style={{ marginBottom: '20px' }}>
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
              <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                RECOMMENDATION RESULTS
              </span>
              <h2 style={{ fontSize: '17px', fontWeight: '600', color: '#FFFFFF', marginTop: '2px' }}>
                Standards Recommended for "{requirement?.product || 'Requirement'}"
              </h2>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="badge badge-gold">
                {totalResultsCount} Results
              </span>
              <span className="badge badge-blue">
                {primaryStandards.length} Primary
              </span>
              <span className="badge badge-neutral">
                {alliedStandards.length} Allied
              </span>
            </div>
          </div>

          {/* Filters & Sorting Bar */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            background: 'var(--bg-surface)',
            padding: '10px 16px',
            borderRadius: '6px',
            border: '1px solid var(--border-subtle)'
          }}>
            {/* Filter Tabs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Filter size={13} color="var(--text-muted)" style={{ marginRight: '4px' }} />
              <button
                onClick={() => setFilterType('all')}
                className={`btn btn-sm ${filterType === 'all' ? 'btn-primary' : 'btn-outline'}`}
              >
                All ({totalResultsCount})
              </button>
              <button
                onClick={() => setFilterType('primary')}
                className={`btn btn-sm ${filterType === 'primary' ? 'btn-primary' : 'btn-outline'}`}
              >
                Primary ({primaryStandards.length})
              </button>
              <button
                onClick={() => setFilterType('allied')}
                className={`btn btn-sm ${filterType === 'allied' ? 'btn-primary' : 'btn-outline'}`}
              >
                Allied ({alliedStandards.length})
              </button>
              <button
                onClick={() => setFilterType('verified')}
                className={`btn btn-sm ${filterType === 'verified' ? 'btn-primary' : 'btn-outline'}`}
              >
                BIS Verified
              </button>
            </div>

            {/* Sort Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: 'var(--text-secondary)' }}>
              <ArrowUpDown size={13} color="var(--text-muted)" />
              <span>Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{
                  background: 'var(--bg-app)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '4px',
                  padding: '4px 8px',
                  fontSize: '12px',
                  color: 'var(--text-primary)'
                }}
              >
                <option value="relevance">Relevance Score</option>
                <option value="is_number">IS Number</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Results Cards List */}
      {totalResultsCount > 0 && (
        <div>
          {/* Primary Standards Section */}
          {displayPrimary.length > 0 && (
            <div style={{ marginBottom: '28px' }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--interactive-blue)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
                PRIMARY RECOMMENDATIONS ({displayPrimary.length})
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

          {/* Supporting / Allied Standards Section */}
          {displayAllied.length > 0 && (
            <div>
              <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
                SUPPORTING & ALLIED STANDARDS ({displayAllied.length})
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
          // If user clicks a referenced standard in the drawer, load or search that standard
          onAnalyze(isNum, 'is_number', true);
        }}
      />
    </div>
  );
}
