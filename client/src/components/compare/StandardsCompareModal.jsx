import React from 'react';
import { X, Scale, ExternalLink, ShieldCheck, CheckCircle2 } from 'lucide-react';

export default function StandardsCompareModal({ 
  isOpen, 
  onClose, 
  standards = [], 
  onRemoveStandard,
  onViewDetails 
}) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '1100px',
          maxHeight: '85vh',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-medium)',
          borderRadius: '8px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 48px rgba(0,0,0,0.7)'
        }}
      >
        {/* Modal Header */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface-elevated)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Scale size={18} color="var(--accent-gold-light)" />
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#FFFFFF' }}>
              Comparative Standards Analysis ({standards.length} Selected)
            </h3>
          </div>
          <button 
            onClick={onClose}
            style={{ padding: '4px', borderRadius: '4px', color: 'var(--text-secondary)' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body: Comparison Table */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {standards.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              No standards currently selected for comparison. Click "Compare" on any recommendation card.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-medium)' }}>
                    <th style={{ padding: '12px 14px', width: '200px', color: 'var(--text-muted)', fontSize: '11.5px', textTransform: 'uppercase' }}>
                      Specification Metric
                    </th>
                    {standards.map((s, idx) => (
                      <th key={idx} style={{ padding: '12px 14px', minWidth: '260px', verticalAlign: 'top' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                          <div>
                            <span className="is-code" style={{ fontSize: '14px', color: '#FFFFFF' }}>{s.is_number}</span>
                            <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginTop: '2px', lineHeight: 1.3 }}>
                              {s.title}
                            </div>
                          </div>
                          <button
                            onClick={() => onRemoveStandard(s.is_number)}
                            title="Remove from comparison"
                            style={{ color: 'var(--text-muted)', padding: '2px' }}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Scope Row */}
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Scope & Applicability
                    </td>
                    {standards.map((s, idx) => (
                      <td key={idx} style={{ padding: '12px 14px', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                        {s.scope || "Product specification and compliance testing requirements."}
                      </td>
                    ))}
                  </tr>

                  {/* Status & Verification */}
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Status & Verification
                    </td>
                    {standards.map((s, idx) => (
                      <td key={idx} style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <span className="badge badge-verified">
                            ● {s.bis_status || "ACTIVE"}
                          </span>
                          <span className="badge badge-gold">
                            {s.verification_source === 'official_bis_live' ? 'BIS LIVE' : 'BIS VERIFIED'}
                          </span>
                        </div>
                      </td>
                    ))}
                  </tr>

                  {/* Department & Committee */}
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Technical Directorate
                    </td>
                    {standards.map((s, idx) => (
                      <td key={idx} style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>
                        <div>{s.department || "Bureau of Indian Standards"}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.technical_committee || "Sectional Committee"}</div>
                      </td>
                    ))}
                  </tr>

                  {/* Certification / QCO */}
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Certification Context
                    </td>
                    {standards.map((s, idx) => {
                      const cert = s.certification || {};
                      return (
                        <td key={idx} style={{ padding: '12px 14px' }}>
                          <span className={`badge ${cert.mandatory ? 'badge-error' : 'badge-gold'}`}>
                            {cert.mandatory ? 'COMPULSORY (QCO)' : 'VOLUNTARY (ISI OPTIONAL)'}
                          </span>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Normative References */}
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Normative References
                    </td>
                    {standards.map((s, idx) => (
                      <td key={idx} style={{ padding: '12px 14px' }}>
                        {s.normative_references?.length > 0 ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {s.normative_references.map((ref, rIdx) => (
                              <span key={rIdx} className="is-code" style={{ fontSize: '11px', background: 'var(--bg-app)', padding: '2px 6px', borderRadius: '3px' }}>
                                {ref}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>Referenced in text</span>
                        )}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
