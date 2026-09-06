import React from 'react';
import { AlertTriangle, ArrowRight, ShieldCheck } from 'lucide-react';

export default function PartialResultsBanner({ localCount = 0, onAcknowledge }) {
  return (
    <div style={{
      background: 'rgba(245, 158, 11, 0.08)',
      border: '1px solid rgba(245, 158, 11, 0.25)',
      borderRadius: '6px',
      padding: '14px 18px',
      marginBottom: '20px',
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <AlertTriangle size={18} color="var(--accent-gold-light)" />
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent-gold-light)' }}>
            Partial Results: Operating in Offline Verified Mode
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Showing {localCount} standard(s) from the local verified repository. Live BIS portal verification is currently unavailable.
          </div>
        </div>
      </div>

      {onAcknowledge && (
        <button 
          onClick={onAcknowledge}
          className="btn btn-outline btn-sm"
          style={{ fontSize: '12px', borderColor: 'rgba(245, 158, 11, 0.3)', color: 'var(--accent-gold-light)' }}
        >
          <span>Continue with Local Results</span>
          <ArrowRight size={13} />
        </button>
      )}
    </div>
  );
}
