import React, { useState } from 'react';
import { 
  X, 
  ExternalLink, 
  ShieldCheck, 
  FileText, 
  Layers, 
  BookOpen, 
  History,
  FlaskConical
} from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import BisSourceBadge from './BisSourceBadge';

export default function StandardDetailsDrawer({ 
  standard, 
  onClose,
  onSelectStandard
}) {
  if (!standard) return null;

  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState('basic');

  const isNumber = standard.is_number || "IS Standard";
  const title = standard.title || "Indian Standard Specification";
  const status = standard.bis_status || standard.status || "Active";
  const isCurrent = status.toLowerCase() === 'active' || status.toLowerCase() === 'current';
  const isBisLive = standard.verification_source === 'official_bis_live' || standard.data_source === 'BIS_LIVE';
  const isLocalVerified = standard.verification_source === 'official_bis_cache' || standard.data_source === 'LOCAL_KNOWLEDGE_BASE';
  const isMongoCached = standard.verification_source === 'mongodb_cache' || standard.data_source === 'MONGODB_CACHE';

  const officialBisUrl = standard.official_bis_url || (standard.detail_url && standard.detail_url.includes('/standard-details') ? standard.detail_url : null);
  const cert = standard.certification;
  const lifecycle = standard.lifecycle || {};
  const verifiedLinks = Array.isArray(standard.referenced_bis_links) ? standard.referenced_bis_links : [];

  const findVerifiedBisUrl = (refText) => {
    if (!refText || verifiedLinks.length === 0) return null;
    const cleanRef = String(refText).replace(/\s+/g, ' ').trim().toLowerCase();
    const found = verifiedLinks.find(v => {
      const vNum = (v.standard_number || '').replace(/\s+/g, ' ').trim().toLowerCase();
      return vNum && (vNum.includes(cleanRef) || cleanRef.includes(vNum));
    });
    return (found?.detail_url && found.detail_url.includes('/standard-details')) ? found.detail_url : null;
  };

  const tabs = [
    { id: 'basic', label: t('tabBasic'), icon: FileText },
    { id: 'technical', label: t('tabTechnical'), icon: FlaskConical },
    { id: 'classification', label: t('tabClassification'), icon: Layers },
    { id: 'certification', label: t('tabCertification'), icon: ShieldCheck },
    { id: 'lifecycle', label: t('tabLifecycle'), icon: History },
    { id: 'referred', label: t('tabReferred'), icon: BookOpen },
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
          {value || t('notAvailableFromBis')}
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
                  <span className="badge badge-verified">{t('currentBadge').toUpperCase()}</span>
                ) : (
                  <span className="badge badge-warning">{status.toUpperCase()}</span>
                )}

                {isBisLive ? (
                  <span className="badge badge-gold">{t('liveBisVerified').toUpperCase()}</span>
                ) : isLocalVerified ? (
                  <span className="badge badge-verified">{t('localVerifiedIndex').toUpperCase()}</span>
                ) : isMongoCached ? (
                  <span className="badge badge-blue">{t('mongoCached').toUpperCase()}</span>
                ) : (
                  <span className="badge badge-warning">{t('unverified').toUpperCase()}</span>
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
            {tabs.map(tTab => {
              const Icon = tTab.icon;
              const isActive = activeTab === tTab.id;
              return (
                <button
                  key={tTab.id}
                  onClick={() => setActiveTab(tTab.id)}
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
                  <span>{tTab.label}</span>
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
                    {t('scopeTechnicalDesc')}
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

          {/* TAB 2: TECHNICAL CONTENT (Safety, Test Methods, Material) */}
          {activeTab === 'technical' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Safety Requirements */}
              <div style={{
                padding: '16px',
                background: '#FFFFFF',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px'
              }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                  {t('safetyRequirements')}
                </div>
                {Array.isArray(standard.safety_standards) && standard.safety_standards.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {standard.safety_standards.map((saf, i) => (
                      <span key={i} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '4px 10px', borderRadius: '4px', fontSize: '13px' }}>
                        {typeof saf === 'object' ? (saf.is_number || saf.title) : saf}
                      </span>
                    ))}
                  </div>
                ) : standard.scope && /safety|protection|ingress|hazard|flame|shock/i.test(standard.scope) ? (
                  <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                    {standard.scope}
                  </p>
                ) : (
                  <span style={{ fontSize: '13px', color: 'var(--text-light)', fontStyle: 'italic' }}>
                    {t('notAvailableFromBis')}
                  </span>
                )}
              </div>

              {/* Test Measurements & Methods */}
              <div style={{
                padding: '16px',
                background: '#FFFFFF',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px'
              }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                  {t('testMeasurementsMethods')}
                </div>
                {Array.isArray(standard.test_methods) && standard.test_methods.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {standard.test_methods.map((tm, i) => (
                      <span key={i} className="is-code" style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '4px 10px', borderRadius: '4px', fontSize: '12.5px' }}>
                        {typeof tm === 'object' ? (tm.is_number || tm.title) : tm}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span style={{ fontSize: '13px', color: 'var(--text-light)', fontStyle: 'italic' }}>
                    {t('notAvailableFromBis')}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: CLASSIFICATION */}
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

          {/* TAB 4: CERTIFICATION */}
          {activeTab === 'certification' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{
                padding: '20px',
                background: '#FFFFFF',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px'
              }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                  {t('officialConformity')}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)' }}>
                    {cert?.status ? cert.status : t('notAvailableFromBis')}
                  </span>
                  {cert?.mandatory !== null && cert?.mandatory !== undefined && (
                    <span className={`badge ${cert.mandatory ? 'badge-gold' : 'badge-neutral'}`}>
                      {cert.mandatory ? t('mandatoryQco').toUpperCase() : t('voluntary').toUpperCase()}
                    </span>
                  )}
                </div>

                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  Under the Bureau of Indian Standards Act, Indian Standards are voluntary unless notified under a mandatory Quality Control Order (QCO) issued by the relevant Central Ministry.
                </p>
              </div>
            </div>
          )}

          {/* TAB 5: LIFECYCLE & AMENDMENTS */}
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
                    {t('gazetteAmendments')}
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

          {/* TAB 6: REFERRED STANDARDS */}
          {activeTab === 'referred' && (
            <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{
                padding: '16px',
                background: '#FFFFFF',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px'
              }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>
                  {t('normativeReferences')}
                </div>
                {standard.normative_references?.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {standard.normative_references.map((ref, idx) => {
                      const verifiedUrl = findVerifiedBisUrl(ref);
                      return (
                        <div key={idx} style={{ display: 'inline-flex', alignItems: 'center', background: '#FFFFFF', border: '1px solid var(--border-subtle)', borderRadius: '4px', overflow: 'hidden' }}>
                          <button
                            type="button"
                            onClick={() => onSelectStandard && onSelectStandard(ref)}
                            className="btn btn-secondary btn-sm is-code"
                            style={{ border: 'none', borderRadius: 0, padding: '4px 8px' }}
                            title="Search this standard in ISRA"
                          >
                            <span>{ref}</span>
                          </button>
                          {verifiedUrl && (
                            <a
                              href={verifiedUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '4px 8px',
                                background: '#EFF6FF',
                                borderLeft: '1px solid var(--border-subtle)',
                                color: 'var(--primary-blue)',
                                fontSize: '11px',
                                fontWeight: 600,
                                textDecoration: 'none'
                              }}
                              title="Open verified standard details on official BIS portal"
                            >
                              <span>BIS ↗</span>
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ fontSize: '13px', color: 'var(--text-light)' }}>
                    {t('notAvailableFromBis')}
                  </div>
                )}
              </div>

              {/* Direct BIS Portal Reference Links */}
              {verifiedLinks.length > 0 && (
                <div style={{
                  padding: '16px',
                  background: '#FFFFFF',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px'
                }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>
                    {t('verifiedReferencedOnBis')} ({verifiedLinks.length})
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {verifiedLinks.map((item, idx) => (
                      <div key={idx} style={{ display: 'inline-flex', alignItems: 'center', background: '#FFFFFF', border: '1px solid var(--border-subtle)', borderRadius: '4px', overflow: 'hidden' }}>
                        <button
                          type="button"
                          onClick={() => onSelectStandard && onSelectStandard(item.standard_number)}
                          className="btn btn-secondary btn-sm is-code"
                          style={{ border: 'none', borderRadius: 0, padding: '4px 8px' }}
                          title="Search this standard in ISRA"
                        >
                          <span>{item.standard_number}</span>
                        </button>
                        {item.detail_url && item.detail_url.includes('/standard-details') && (
                          <a
                            href={item.detail_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '4px 8px',
                              background: '#EFF6FF',
                              borderLeft: '1px solid var(--border-subtle)',
                              color: 'var(--primary-blue)',
                              fontSize: '11px',
                              fontWeight: 600,
                              textDecoration: 'none'
                            }}
                            title="Open on official BIS portal"
                          >
                            <span>BIS ↗</span>
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
            {t('close')}
          </button>

          {officialBisUrl ? (
            <BisSourceBadge
              verified={isBisLive || isLocalVerified}
              url={officialBisUrl}
              customLabel={t('openBisPage')}
              style={{ padding: '8px 18px', fontSize: '13px' }}
            />
          ) : (
            <span style={{ fontSize: '12.5px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              {t('notAvailableFromBis')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
