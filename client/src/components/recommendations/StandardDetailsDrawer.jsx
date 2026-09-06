import React, { useState } from 'react';
import { 
  X, 
  ExternalLink, 
  ShieldCheck, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Calendar, 
  Building, 
  Layers, 
  BookOpen, 
  Beaker, 
  ShieldAlert, 
  Award, 
  History 
} from 'lucide-react';

export default function StandardDetailsDrawer({ 
  standard, 
  onClose,
  onSelectStandard
}) {
  if (!standard) return null;

  const [activeTab, setActiveTab] = useState('overview');

  const isNumber = standard.is_number || "IS Standard";
  const title = standard.title || "Indian Standard Specification";
  const status = standard.bis_status || standard.status || "Active";
  const isCurrent = status.toLowerCase() === 'active' || status.toLowerCase() === 'current';
  const verification = standard.verification || {};
  const isBisLive = standard.verification_source === 'official_bis_live' || standard.data_source === 'BIS_LIVE';
  const officialBisUrl = standard.official_bis_url || standard.detail_url || "";
  const cert = standard.certification || {};

  const tabs = [
    { id: 'overview', label: 'Overview', icon: FileText },
    { id: 'applicability', label: 'Applicability', icon: Layers },
    { id: 'requirements', label: 'Requirements', icon: CheckCircle },
    { id: 'references', label: 'References', icon: BookOpen },
    { id: 'testing', label: 'Testing', icon: Beaker },
    { id: 'safety', label: 'Safety', icon: ShieldAlert },
    { id: 'certification', label: 'Certification', icon: Award },
    { id: 'lifecycle', label: 'Lifecycle', icon: History },
    { id: 'bis', label: 'BIS Information', icon: ExternalLink },
  ];

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '680px',
          height: '100%',
          background: 'var(--bg-surface)',
          borderLeft: '1px solid var(--border-medium)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-8px 0 24px rgba(0,0,0,0.5)',
          overflow: 'hidden'
        }}
      >
        {/* Drawer Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface-elevated)'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span className="is-code" style={{ fontSize: '18px', color: '#FFFFFF' }}>
                  {isNumber}
                </span>

                {isCurrent ? (
                  <span className="badge badge-verified">CURRENT</span>
                ) : (
                  <span className="badge badge-warning">{status.toUpperCase()}</span>
                )}

                {isBisLive ? (
                  <span className="badge badge-gold">BIS LIVE DISCOVERED</span>
                ) : (
                  <span className="badge badge-verified">BIS VERIFIED</span>
                )}
              </div>

              <h2 style={{ fontSize: '15px', color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.4 }}>
                {title}
              </h2>
            </div>

            <button 
              onClick={onClose}
              style={{
                padding: '6px',
                borderRadius: '4px',
                color: 'var(--text-secondary)',
                background: 'rgba(255,255,255,0.05)'
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Navigation Tabs Bar */}
          <div style={{
            display: 'flex',
            gap: '6px',
            overflowX: 'auto',
            marginTop: '16px',
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
                    padding: '6px 12px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? '#FFFFFF' : 'var(--text-secondary)',
                    background: isActive ? 'var(--interactive-blue)' : 'rgba(255,255,255,0.03)',
                    border: '1px solid ' + (isActive ? 'transparent' : 'var(--border-subtle)'),
                    whiteSpace: 'nowrap'
                  }}
                >
                  <Icon size={13} />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Drawer Body Tabs Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="animate-fade-in">
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent-gold-light)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                  Standard Scope & Abstract
                </h4>
                <p style={{ fontSize: '13.5px', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                  {standard.scope || `This standard specifies requirements and methods of sampling and test for general procurement and quality verification for ${title}.`}
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', marginBottom: '20px' }}>
                <div className="card-panel" style={{ padding: '12px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>IS Number</div>
                  <div className="is-code" style={{ fontSize: '14px', color: '#FFFFFF', marginTop: '2px' }}>{isNumber}</div>
                </div>

                <div className="card-panel" style={{ padding: '12px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Lifecycle Status</div>
                  <div style={{ fontSize: '14px', color: isCurrent ? 'var(--status-verified)' : 'var(--status-warning)', fontWeight: 600, marginTop: '2px' }}>
                    {status}
                  </div>
                </div>

                <div className="card-panel" style={{ padding: '12px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Technical Department</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginTop: '2px' }}>
                    {standard.department || "Bureau of Indian Standards (BIS)"}
                  </div>
                </div>

                <div className="card-panel" style={{ padding: '12px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Technical Committee</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginTop: '2px' }}>
                    {standard.technical_committee || "Sectional Committee"}
                  </div>
                </div>

                <div className="card-panel" style={{ padding: '12px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Type of Standard</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginTop: '2px' }}>
                    {standard.type_of_standard || "Product Specification"}
                  </div>
                </div>

                <div className="card-panel" style={{ padding: '12px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Language</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginTop: '2px' }}>English / Bilingual</div>
                </div>
              </div>

              {standard.official_bis_url && (
                <a
                  href={standard.official_bis_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%' }}
                >
                  <span>Open Official Record on BIS Portal</span>
                  <ExternalLink size={13} />
                </a>
              )}
            </div>
          )}

          {/* TAB 2: APPLICABILITY */}
          {activeTab === 'applicability' && (
            <div className="animate-fade-in">
              <div style={{ marginBottom: '18px' }}>
                <h4 style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent-gold-light)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                  Procurement Applicability
                </h4>
                <p style={{ fontSize: '13.5px', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                  {standard.structured_explanation?.applicability || `Directly applicable for public works, government procurement tenders, and technical compliance verification for ${title}.`}
                </p>
              </div>

              <div style={{ marginBottom: '18px' }}>
                <h4 style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                  Recommended Procurement Checks
                </h4>
                <div style={{ background: 'var(--bg-app)', padding: '14px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                  <ul style={{ paddingLeft: '18px', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    <li>Ensure tender specifies conformity to latest revision ({isNumber}).</li>
                    <li>Verify manufacturer holds valid BIS licence / ISI mark certificate.</li>
                    <li>Mandate submission of test certificate from NABL or BIS recognized laboratory.</li>
                    <li>Inspect sample testing protocols against referenced test method standards.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: REQUIREMENTS */}
          {activeTab === 'requirements' && (
            <div className="animate-fade-in">
              <h4 style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent-gold-light)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
                Procurement Requirement Coverage
              </h4>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-medium)', textAlign: 'left', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '8px 4px' }}>Requirement Dimension</th>
                    <th style={{ padding: '8px 4px', textAlign: 'right' }}>Coverage Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '10px 4px', color: 'var(--text-primary)' }}>Product Core Specifications</td>
                    <td style={{ padding: '10px 4px', textAlign: 'right', color: 'var(--status-verified)', fontWeight: 600 }}>Strong Coverage</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '10px 4px', color: 'var(--text-primary)' }}>Safety & Electrical Protection</td>
                    <td style={{ padding: '10px 4px', textAlign: 'right', color: 'var(--status-verified)', fontWeight: 600 }}>Strong Coverage</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '10px 4px', color: 'var(--text-primary)' }}>Sampling & Quality Inspection</td>
                    <td style={{ padding: '10px 4px', textAlign: 'right', color: 'var(--accent-gold-light)', fontWeight: 600 }}>Moderate Coverage</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '10px 4px', color: 'var(--text-primary)' }}>Site-Specific Installation Conditions</td>
                    <td style={{ padding: '10px 4px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 500 }}>Allied Standard Needed</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* TAB 4: REFERENCES */}
          {activeTab === 'references' && (
            <div className="animate-fade-in">
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent-gold-light)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                  Normative References
                </h4>
                {standard.normative_references?.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {standard.normative_references.map((ref, idx) => (
                      <button
                        key={idx}
                        onClick={() => onSelectStandard && onSelectStandard(ref)}
                        className="btn btn-outline btn-sm is-code"
                        style={{ fontSize: '12.5px' }}
                      >
                        <span>{ref}</span>
                        <ExternalLink size={12} />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    Referenced standards cited within the text of this specification.
                  </div>
                )}
              </div>

              <div>
                <h4 style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                  Test Method Standards
                </h4>
                {standard.test_methods?.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {standard.test_methods.map((ref, idx) => (
                      <button
                        key={idx}
                        onClick={() => onSelectStandard && onSelectStandard(ref)}
                        className="btn btn-outline btn-sm is-code"
                        style={{ fontSize: '12.5px' }}
                      >
                        <span>{ref}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    Test procedures defined in parent specification.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: TESTING */}
          {activeTab === 'testing' && (
            <div className="animate-fade-in">
              <h4 style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent-gold-light)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
                Testing & Inspection Provisions
              </h4>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '14px' }}>
                This Indian Standard specifies mechanical, electrical, and durability test methods to ensure compliance under Indian climatic and operational conditions.
              </p>
              <div style={{ background: 'var(--bg-app)', padding: '14px', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  Laboratory Acceptance Testing
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                  Mandatory routine testing and type tests must be executed in accordance with BIS Scheme of Inspection and Testing (SIT).
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: SAFETY */}
          {activeTab === 'safety' && (
            <div className="animate-fade-in">
              <h4 style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent-gold-light)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
                Safety & Compliance Guidelines
              </h4>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '14px' }}>
                Specifies occupational, electrical, and environmental safety precautions required during manufacturing, installation, and public deployment.
              </p>
              <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '14px', borderRadius: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--status-error)', fontWeight: 600, fontSize: '13px', marginBottom: '4px' }}>
                  <ShieldAlert size={16} />
                  <span>Public Safety Directive</span>
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)' }}>
                  Failure to comply with mandatory safety specifications in public infrastructure procurement may violate National Building Code (NBC) and Central Vigilance Commission (CVC) guidelines.
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: CERTIFICATION */}
          {activeTab === 'certification' && (
            <div className="animate-fade-in">
              <h4 style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent-gold-light)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
                Conformity Assessment & QCO Information
              </h4>

              <div className="card-panel" style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Certification Status:</span>
                  <span className={`badge ${cert.mandatory ? 'badge-error' : 'badge-gold'}`}>
                    {cert.mandatory ? 'COMPULSORY (QCO)' : 'VOLUNTARY (ISI OPTIONAL)'}
                  </span>
                </div>

                <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  Under the Bureau of Indian Standards Act, Indian Standards are voluntary by default unless notified under a mandatory Quality Control Order (QCO) issued by the relevant Central Ministry.
                </div>
              </div>

              <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                <strong>Procurement Recommendation:</strong> Government buyers on the Government e-Marketplace (GeM) frequently mandate BIS certification as a quality filter even when statutory QCO notifications are voluntary.
              </div>
            </div>
          )}

          {/* TAB 8: LIFECYCLE */}
          {activeTab === 'lifecycle' && (
            <div className="animate-fade-in">
              <h4 style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent-gold-light)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '16px' }}>
                Standard Revision Timeline
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', position: 'relative', paddingLeft: '24px' }}>
                <div style={{ position: 'absolute', top: '10px', bottom: '10px', left: '8px', width: '2px', background: 'var(--border-medium)' }} />

                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '-20px', top: '4px', width: '10px', height: '10px', borderRadius: '50%', background: 'var(--status-verified)' }} />
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Current Active Edition</div>
                  <div className="is-code" style={{ fontSize: '12px', color: 'var(--status-verified)' }}>{isNumber}</div>
                </div>

                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '-20px', top: '4px', width: '10px', height: '10px', borderRadius: '50%', background: 'var(--text-muted)' }} />
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Periodic Review & Reaffirmation</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Confirmed active by BIS Technical Directorate</div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 9: BIS INFORMATION */}
          {activeTab === 'bis' && (
            <div className="animate-fade-in">
              <h4 style={{ fontSize: '12px', fontWeight: '700', color: 'var(--accent-gold-light)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>
                Official BIS Know Your Standards Portal
              </h4>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '16px' }}>
                The official BIS Portal exposes complete authentic standard documents, gazette notifications, testing/inspection schemes, manufacturer licences and certified laboratories.
              </p>

              {officialBisUrl ? (
                <div style={{ background: 'var(--bg-app)', padding: '16px', borderRadius: '6px', border: '1px solid var(--border-subtle)', marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>Canonical BIS URL:</div>
                  <a 
                    href={officialBisUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="is-code"
                    style={{ fontSize: '12px', wordBreak: 'break-all', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <span>{officialBisUrl}</span>
                    <ExternalLink size={13} />
                  </a>
                </div>
              ) : (
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  Direct URL lookup available on standards.bis.gov.in.
                </div>
              )}

              <a
                href={`https://standards.bis.gov.in/website/know-your-standards?searchTerm=${encodeURIComponent(isNumber)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
                style={{ width: '100%' }}
              >
                <span>Search {isNumber} on Official BIS Portal</span>
                <ExternalLink size={14} />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
