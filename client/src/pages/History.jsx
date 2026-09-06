import React, { useState } from 'react';
import { 
  Clock, 
  Search, 
  Trash2, 
  ArrowRight, 
  Layers, 
  CheckCircle2, 
  FileText 
} from 'lucide-react';

export default function History({ historyItems = [], onOpenHistoryItem, onClearHistory }) {
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = historyItems.filter(item => {
    const q = (item.query || '').toLowerCase();
    const prod = (item.product || '').toLowerCase();
    const st = searchTerm.toLowerCase();
    return q.includes(st) || prod.includes(st);
  });

  return (
    <div className="page-body">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '4px' }}>
            Workspace / History
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#FFFFFF' }}>
            Procurement Analysis History & Audit Trail
          </h1>
          <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Previous requirement analyses, detected Indian Standards, and compliance queries saved in your local session.
          </p>
        </div>

        {historyItems.length > 0 && (
          <button
            onClick={onClearHistory}
            className="btn btn-outline btn-sm"
            style={{ color: 'var(--status-error)', borderColor: 'rgba(239,68,68,0.25)' }}
          >
            <Trash2 size={13} />
            <span>Clear History</span>
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="card-panel" style={{ padding: '14px 18px', marginBottom: '20px' }}>
        <div style={{ position: 'relative' }}>
          <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '11px' }} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter past procurement queries..."
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              background: 'var(--bg-app)',
              border: '1px solid var(--border-medium)',
              borderRadius: '6px',
              color: 'var(--text-primary)',
              fontSize: '13px'
            }}
          />
        </div>
      </div>

      {/* History Items List */}
      <div className="card-panel" style={{ padding: 0, overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <Clock size={32} style={{ margin: '0 auto 12px auto', opacity: 0.4 }} />
            <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '4px' }}>
              No Analysis Records Found
            </div>
            <div style={{ fontSize: '12px' }}>
              Queries analyzed in the Recommendations workspace will be logged here automatically.
            </div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'var(--bg-surface-elevated)', borderBottom: '1px solid var(--border-medium)', color: 'var(--text-muted)', fontSize: '11.5px', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 16px' }}>Procurement Requirement</th>
                <th style={{ padding: '12px 16px' }}>Identified Product</th>
                <th style={{ padding: '12px 16px' }}>Standards Found</th>
                <th style={{ padding: '12px 16px' }}>Date & Time</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, idx) => (
                <tr
                  key={idx}
                  style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    transition: 'background 0.1s ease',
                    cursor: 'pointer'
                  }}
                  onClick={() => onOpenHistoryItem(item)}
                >
                  <td style={{ padding: '14px 16px', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {item.query}
                  </td>
                  <td style={{ padding: '14px 16px', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                    {item.product || "General Procurement"}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span className="badge badge-verified">
                      {item.standardsCount || 0} Standards
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: '12px' }}>
                    {item.timestamp || "Today"}
                  </td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => onOpenHistoryItem(item)}
                      className="btn btn-secondary btn-sm"
                    >
                      <span>Reopen Analysis</span>
                      <ArrowRight size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
