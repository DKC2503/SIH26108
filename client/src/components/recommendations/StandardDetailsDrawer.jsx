import React, { useState } from 'react';
import { 
  X, 
  ExternalLink, 
  ShieldCheck, 
  FileText, 
  CheckCircle, 
  Layers, 
  BookOpen, 
  History,
  Building,
  Calendar,
  AlertCircle
} from 'lucide-react';

export default function StandardDetailsDrawer({ 
  standard, 
  onClose,
  onSelectStandard
}) {
  if (!standard) return null;

  const [activeTab, setActiveTab] = useState('basic');

  const isNumber = standard.is_number || "IS Standard";
  const title = standard.title || "Indian Standard Specification";
  const status = standard.bis_status || standard.status || "Active";
  const isCurrent = status.toLowerCase() === 'active' || status.toLowerCase() === 'current';
  const isBisLive = standard.verification_source === 'official_bis_live' || standard.data_source === 'BIS_LIVE';
  const officialBisUrl = standard.official_bis_url || (standard.detail_url && standard.detail_url.includes('/standard-details') ? standard.detail_url : null);
  const cert = standard.certification;
  const lifecycle = standard.lifecycle || {};

  const tabs = [
    { id: 'basic', label: 'Basic Details', icon: FileText },
    { id: 'classification', label: 'Classification', icon: Layers },
    { id: 'certification', label: 'Certification', icon: ShieldCheck },
    { id: 'lifecycle', label: 'Lifecycle & Amendments', icon: History },
    { id: 'referred', label: 'Referred Standards', icon: BookOpen },
  ];

  const renderField = (label, value) => {
    return (
      <div style={{
        padding: '12px 16px',
        background: '#FFFFFF',
        border: '1px solid var(--border-subtle)',
        borderRadius: '6px',
        display: 'flex',
        flexDirection: 'column',
        gap: '3px'
      }}>
        <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {label}
        </div>
        <div style={{ fontSize: '13.5px', color: value ? 'var(--text-main)' : 'var(--text-light)', fontWeight: value ? 500 : 400 }}>
          {value || "Not available on BIS portal"}
        </div>
      </div>
    );
  };

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '680px',
          height: '100%',
          background: '#FFFFFF',
          borderLeft: '1px solid var(--border-medium)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-8px 0 32px rgba(15, 23, 42, 0.15)',
          overflow: 'hidden'
        }}
      >
        {/* Drawer Header */}
        <div style={{
          padding: '24px 28px 16px 28px',
          borderBottom: '1px solid var(--border-subtle)',
          background: '#FFFFFF'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                <span className="is-code" style={{ fontSize: '19px', color: 'var(--text-main)' }}>
                  {isNumber}
                </span>

                {isCurrent ? (
                  <span className="badge badge-verified">CURRENT</span>
                ) : (
                  <span className="badge badge-warning">{status.toUpperCase()}</span>
                )}

                {isBisLive ? (
                  <span className="badge badge-gold">LIVE BIS VERIFIED</span>
                ) : (standard.verification_source === 'official_bis_cache' || standard.data_source === 'LOCAL_KNOWLEDGE_BASE') ? (
                  <span className="badge badge-verified">LOCAL VERIFIED INDEX</span>
                ) : (standard.verification_source === 'mongodb_cache' || standard.data_source === 'MONGODB_CACHE') ? (
                  <span className="badge badge-blue">MONGODB CACHED</span>
                ) : (
                  <span className="badge badge-warning">UNVERIFIED</span>
                )}
              </div>

              <h2 style={{ fontSize: '15px', color: 'var(--text-main)', fontWeight: 500, lineHeight: 1.45 }}>
                {title}
              </h2>
            </div>

            <button 
              onClick={onClose}
              style={{
                padding: '6px',
                borderRadius: '6px',
                color: 'var(--text-muted)',
                background: '#F1F5F9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Clean Light Tabs Bar */}
          <div style={{
            display: 'flex',
            gap: '6px',
            overflowX: 'auto',
            marginTop: '18px',
            borderBottom: '1px solid var(--border-subtle)',
            paddingBottom: '2px'
          }}>
            {tabs.map(t => {
              const Icon = t.icon;
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 12px',
                    borderBottom: isActive ? '2px solid var(--primary-blue)' : '2px solid transparent',
                    fontSize: '13px',
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? 'var(--primary-blue)' : 'var(--text-muted)',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <Icon size={14} />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Drawer Body Tabs Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', background: '#F8FAFC' }}>
          {/* TAB 1: BASIC DETAILS */}
          {activeTab === 'basic' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {standard.scope && (
                <div style={{
                  padding: '16px',
                  background: '#FFFFFF',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px'
                }}>
                  <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Scope & Technical Description
                  </div>
                  <p style={{ fontSize: '13.5px', color: 'var(--text-main)', lineHeight: 1.6 }}>
                    {standard.scope}
                  </p>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                {renderField("IS Number", isNumber)}
                {renderField("Status", status)}
                {renderField("Published / Reviewed Year", standard.reviewed_in || standard.published_year || lifecycle.reviewed_in)}
                {renderField("Technical Department", standard.department)}
                {renderField("Technical Committee", standard.technical_committee)}
                {renderField("Type of Standard", standard.type_of_standard)}
                {renderField("Degree of Equivalence", standard.degree_of_equivalence)}
                {renderField("Reaffirmation Year", standard.reaffirmation_year || lifecycle.reaffirmation_year)}
              </div>
            </div>
          )}

          {/* TAB 2: CLASSIFICATION */}
          {activeTab === 'classification' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                {renderField("Group", standard.group || standard.category)}
                {renderField("Sub-Group", standard.sub_group || standard.sub_category)}
                {renderField("Sub Sub-Group", standard.sub_sub_group)}
                {renderField("ICS Code", standard.ics_code)}
                {renderField("Relevant Ministry", standard.relevant_ministries)}
                {renderField("Short Common Man's Title", standard.short_title || standard.title)}
              </div>
            </div>
          )}

          {/* TAB 3: CERTIFICATION */}
          {activeTab === 'certification' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{
                padding: '20px',
                background: '#FFFFFF',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px'
              }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Official Conformity Assessment & Certification
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)' }}>
                    {cert?.status ? cert.status : "Not available on BIS portal"}
                  </span>
                  {cert?.mandatory !== null && cert?.mandatory !== undefined && (
                    <span className={`badge ${cert.mandatory ? 'badge-gold' : 'badge-neutral'}`}>
                      {cert.mandatory ? 'MANDATORY (QCO / STATUTORY)' : 'VOLUNTARY'}
                    </span>
                  )}
                </div>

                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  Under the Bureau of Indian Standards Act, Indian Standards are voluntary unless notified under a mandatory Quality Control Order (QCO) issued by the relevant Central Ministry.
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: LIFECYCLE & AMENDMENTS */}
          {activeTab === 'lifecycle' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                {renderField("Current Status", status)}
                {renderField("Number of Revisions", standard.number_of_revisions || lifecycle.number_of_revisions)}
                {renderField("Number of Amendments", standard.number_of_amendments || lifecycle.number_of_amendments || (standard.amendments?.length > 0 ? String(standard.amendments.length) : null))}
                {renderField("Superseding IS", standard.superseding_is || lifecycle.superseding_is)}
                {renderField("Reaffirmation Year", standard.reaffirmation_year || lifecycle.reaffirmation_year)}
                {renderField("Reviewed In", standard.reviewed_in || lifecycle.reviewed_in)}
              </div>

              {standard.amendments && standard.amendments.length > 0 && (
                <div style={{
                  padding: '16px',
                  background: '#FFFFFF',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px'
                }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                    Gazette Amendments & Addenda
                  </div>
                  <ul style={{ paddingLeft: '18px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {standard.amendments.map((am, i) => (
                      <li key={i}>{typeof am === 'string' ? am : JSON.stringify(am)}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: REFERRED STANDARDS */}
          {activeTab === 'referred' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{
                padding: '16px',
                background: '#FFFFFF',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px'
              }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>
                  Normative References & Allied Standards
                </div>
                {standard.normative_references?.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {standard.normative_references.map((ref, idx) => (
                      <button
                        key={idx}
                        onClick={() => onSelectStandard && onSelectStandard(ref)}
                        className="btn btn-secondary btn-sm is-code"
                      >
                        <span>{ref}</span>
                        <ExternalLink size={12} />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '13px', color: 'var(--text-light)' }}>
                    Not available on BIS portal
                  </div>
                )}
              </div>

              <div style={{
                padding: '16px',
                background: '#FFFFFF',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px'
              }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>
                  Sampling & Test Method Standards
                </div>
                {standard.test_methods?.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {standard.test_methods.map((ref, idx) => (
                      <button
                        key={idx}
                        onClick={() => onSelectStandard && onSelectStandard(ref)}
                        className="btn btn-secondary btn-sm is-code"
                      >
                        <span>{ref}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '13px', color: 'var(--text-light)' }}>
                    Not available on BIS portal
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Drawer Footer with Official BIS Button */}
        <div style={{
          padding: '18px 28px',
          borderTop: '1px solid var(--border-subtle)',
          background: '#FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <button 
            onClick={onClose}
            className="btn btn-secondary btn-sm"
          >
            Close
          </button>

          {officialBisUrl ? (
            <a
              href={officialBisUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
              style={{ padding: '9px 20px', fontWeight: 600 }}
            >
              <span>Open official BIS page</span>
              <ExternalLink size={15} />
            </a>
          ) : (
            <span style={{ fontSize: '12.5px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Official BIS detail page unavailable
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
