import React from 'react';
import { 
  ShieldCheck, 
  Search, 
  X, 
  Upload, 
  CheckCircle2, 
  ExternalLink,
  Activity
} from 'lucide-react';

export default function Header({ 
  query = '', 
  setQuery, 
  onSearch, 
  onClear, 
  hasResults = false,
  isLoading = false,
  systemStatus = null, 
  onOpenStatusModal,
  onUploadClick
}) {
  const isBisAvailable = systemStatus?.bis === 'available';
  const isApiOnline = systemStatus?.api === 'online';

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSearch && onSearch();
    }
  };

  return (
    <header style={{
      height: '64px',
      background: '#FFFFFF',
      borderBottom: '1px solid var(--border-subtle)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      {/* Left: Brand / Logo */}
      <div 
        onClick={onClear} 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px', 
          cursor: 'pointer',
          userSelect: 'none'
        }}
        title="ISRA Home"
      >
        <img 
          src="/logo.png" 
          alt="ISRA Logo" 
          style={{ 
            height: '32px', 
            width: 'auto', 
            objectFit: 'contain' 
          }} 
        />
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '18px', fontWeight: '800', letterSpacing: '-0.02em', color: 'var(--text-main)' }}>
              ISRA
            </span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1 }}>
            Indian Standards Retrieval Architecture
          </div>
        </div>
      </div>

      {/* Center: Search Bar (Visible when in results mode) */}
      {hasResults && (
        <div style={{ flex: 1, maxWidth: '640px', margin: '0 20px' }}>
          <div className="search-bar-compact">
            <Search size={16} color="var(--text-muted)" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery && setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search Indian Standards (e.g., LED lights, cement, IS 10322)..."
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery && setQuery('')}
                style={{ padding: '2px', color: 'var(--text-muted)' }}
                title="Clear query"
              >
                <X size={14} />
              </button>
            )}
            <button
              type="button"
              onClick={() => onSearch && onSearch()}
              disabled={isLoading || !query.trim()}
              className="btn btn-primary btn-sm"
              style={{ padding: '4px 12px', borderRadius: '16px' }}
            >
              Search
            </button>
          </div>
        </div>
      )}

      {/* Right: Quick actions & Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Add Document button */}
        <button
          onClick={onUploadClick}
          className="btn btn-secondary btn-sm"
          style={{ gap: '6px', fontSize: '12.5px' }}
          title="Upload tender schedule or technical specification document"
        >
          <Upload size={14} color="var(--primary-blue)" />
          <span>+ Add document</span>
        </button>

        {/* System Health indicator pill */}
        <button
          onClick={onOpenStatusModal}
          title="Click to check BIS connectivity & system status"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '16px',
            background: '#F8FAFC',
            border: '1px solid var(--border-subtle)',
            fontSize: '11.5px',
            color: 'var(--text-secondary)'
          }}
        >
          <span style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: isApiOnline ? (isBisAvailable ? '#059669' : '#D97706') : '#DC2626'
          }} />
          <span>{isApiOnline ? (isBisAvailable ? 'BIS Live Active' : 'Local Index Ready') : 'System Offline'}</span>
        </button>
      </div>
    </header>
  );
}
