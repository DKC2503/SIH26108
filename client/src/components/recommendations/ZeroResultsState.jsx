import React from 'react';
import { Search, AlertCircle, ArrowRight, HelpCircle } from 'lucide-react';

export default function ZeroResultsState({ 
  query, 
  bisStatus, 
  onTriggerBisSearch, 
  isLoading 
}) {
  const isBisUnavailable = bisStatus === 'unavailable';

  return (
    <div className="card-panel" style={{
      textAlign: 'center',
      padding: '40px 24px',
      margin: '24px 0',
      border: '1px solid var(--border-medium)',
      background: 'var(--bg-surface)'
    }}>
      <div style={{
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        background: 'rgba(245, 158, 11, 0.1)',
        border: '1px solid rgba(245, 158, 11, 0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 16px auto'
      }}>
        <AlertCircle size={24} color="var(--accent-gold-light)" />
      </div>

      <span className="badge badge-gold" style={{ marginBottom: '8px' }}>
        RECOMMENDATION NOTICE
      </span>

      <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#FFFFFF', marginTop: '4px', marginBottom: '8px' }}>
        No Strong Match Identified in Local Verified Dataset
      </h3>

      <p style={{ maxWidth: '560px', margin: '0 auto 20px auto', fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        We couldn't identify a sufficiently high-confidence standard for <span style={{ color: '#FFFFFF', fontWeight: 600 }}>"{query}"</span> in the local verified Indian Standards catalog.
      </p>

      {/* BIS Status Callout */}
      {isBisUnavailable ? (
        <div style={{
          maxWidth: '520px',
          margin: '0 auto 24px auto',
          background: 'rgba(239, 68, 68, 0.05)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          borderRadius: '6px',
          padding: '12px 16px',
          textAlign: 'left'
        }}>
          <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--status-error)', marginBottom: '4px' }}>
            Live BIS Verification Currently Unavailable
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Automated live discovery could not reach the BIS portal. Try providing more specific technical parameters or direct standard numbers.
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: '24px' }}>
          <button
            onClick={onTriggerBisSearch}
            disabled={isLoading}
            className="btn btn-primary"
            style={{ padding: '9px 20px' }}
          >
            <Search size={15} />
            <span>Search Live BIS Standards Portal</span>
            <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* Helpful Procurement Guidance */}
      <div style={{
        maxWidth: '520px',
        margin: '0 auto',
        paddingTop: '18px',
        borderTop: '1px solid var(--border-subtle)',
        textAlign: 'left'
      }}>
        <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
          Recommended Next Steps for Procurement Officers:
        </div>
        <ul style={{ paddingLeft: '18px', fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <li>Provide specific technical parameters (e.g. wattage, capacity, material grade, IP rating).</li>
          <li>Specify the intended application context (e.g. municipal highway, hospital, substation).</li>
          <li>Enter the product category (e.g. Stationery, Civil Engineering, Electrical).</li>
          <li>Search directly by standard number if cited in previous tender documents.</li>
        </ul>
      </div>
    </div>
  );
}
