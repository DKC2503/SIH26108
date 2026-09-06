import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  ExternalLink, 
  CheckCircle2, 
  Building, 
  ChevronRight, 
  RefreshCw,
  SlidersHorizontal,
  Scale
} from 'lucide-react';
import { searchStandardsCatalog } from '../services/api';

export default function StandardsExplorer({ onViewDetails, onToggleCompare, comparedStandards = [] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [standards, setStandards] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');

  useEffect(() => {
    loadStandards('');
  }, []);

  const loadStandards = async (q) => {
    setIsLoading(true);
    try {
      const data = await searchStandardsCatalog(q);
      setStandards(data || []);
    } catch (err) {
      console.error("Failed to load catalog:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    loadStandards(searchTerm);
  };

  // Categories list
  const categories = ['All', 'Civil Engineering & Construction', 'Electrical & Electronics', 'Stationery', 'Consumer Products', 'Food & Agriculture', 'Plastics & Polymers'];

  // Filtered standards
  const filtered = standards.filter(std => {
    const catMatch = selectedCategory === 'All' || (std.category && std.category.toLowerCase().includes(selectedCategory.toLowerCase()));
    const statusMatch = selectedStatus === 'All' || (std.bis_status || std.status || '').toLowerCase() === selectedStatus.toLowerCase();
    return catMatch && statusMatch;
  });

  return (
    <div className="page-body">
      {/* Breadcrumb & Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '4px' }}>
          Workspace / Standards Explorer
        </div>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#FFFFFF' }}>
          Indian Standards Catalog & Specification Explorer
        </h1>
        <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
          Browse verified Indian Standards, technical committees, normative references, and test specifications.
        </p>
      </div>

      {/* Search & Filter Bar */}
      <div className="card-panel" style={{ padding: '18px 20px', marginBottom: '20px' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
          <div style={{ flex: 1, minWidth: '260px', position: 'relative' }}>
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by IS number, title, material, or keyword (e.g. IS 269, cement, luminaire)..."
              style={{
                width: '100%',
                padding: '9px 12px 9px 36px',
                background: 'var(--bg-app)',
                border: '1px solid var(--border-medium)',
                borderRadius: '6px',
                color: 'var(--text-primary)'
              }}
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ padding: '9px 18px' }}>
            <span>Search Catalog</span>
          </button>
        </form>

        {/* Filter Controls */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
              <Filter size={13} />
              <span>Category:</span>
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              style={{
                background: 'var(--bg-app)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '4px',
                padding: '4px 10px',
                fontSize: '12px',
                color: 'var(--text-secondary)'
              }}
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)', marginLeft: '12px' }}>
              <span>Status:</span>
            </div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              style={{
                background: 'var(--bg-app)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '4px',
                padding: '4px 10px',
                fontSize: '12px',
                color: 'var(--text-secondary)'
              }}
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active / Current</option>
              <option value="Withdrawn">Withdrawn / Superseded</option>
            </select>
          </div>

          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Showing <strong style={{ color: 'var(--text-primary)' }}>{filtered.length}</strong> standard(s)
          </div>
        </div>
      </div>

      {/* Catalog Table */}
      <div className="card-panel" style={{ padding: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading Indian Standards catalog...
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No standards found matching your query.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'var(--bg-surface-elevated)', borderBottom: '1px solid var(--border-medium)', color: 'var(--text-muted)', fontSize: '11.5px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '12px 16px' }}>IS Number</th>
                  <th style={{ padding: '12px 16px' }}>Title & Scope</th>
                  <th style={{ padding: '12px 16px' }}>Category / Department</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((std, idx) => {
                  const isNum = std.is_number;
                  const isCompared = comparedStandards.some(s => s.is_number === isNum);

                  return (
                    <tr 
                      key={idx}
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        transition: 'background 0.1s ease',
                        cursor: 'pointer'
                      }}
                      onClick={() => onViewDetails(std)}
                    >
                      <td style={{ padding: '14px 16px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                        <span className="is-code" style={{ fontSize: '13.5px', color: '#FFFFFF' }}>
                          {isNum}
                        </span>
                      </td>

                      <td style={{ padding: '14px 16px', verticalAlign: 'top' }}>
                        <div style={{ fontWeight: 500, color: 'var(--text-primary)', marginBottom: '4px' }}>
                          {std.title}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {std.scope || "Product specification and compliance testing requirements."}
                        </div>
                      </td>

                      <td style={{ padding: '14px 16px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                        <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                          {std.category || "General Standard"}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {std.department || "BIS Technical Directorate"}
                        </div>
                      </td>

                      <td style={{ padding: '14px 16px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                        <span className="badge badge-verified">
                          ● {std.bis_status || "ACTIVE"}
                        </span>
                      </td>

                      <td style={{ padding: '14px 16px', verticalAlign: 'top', textAlign: 'right', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            onClick={() => onViewDetails(std)}
                            className="btn btn-primary btn-sm"
                          >
                            <span>Inspect</span>
                            <ChevronRight size={13} />
                          </button>

                          <button
                            onClick={() => onToggleCompare(std)}
                            className={`btn ${isCompared ? 'btn-secondary' : 'btn-outline'} btn-sm`}
                            title="Compare standard"
                          >
                            <Scale size={12} color={isCompared ? 'var(--accent-gold-light)' : 'inherit'} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
