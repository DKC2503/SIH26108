import React, { useState } from 'react';
import { 
  ChevronRight, 
  Scale, 
  Bookmark, 
  Building2, 
  Calendar, 
  FileCheck,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  FlaskConical,
  Layers,
  CheckCircle2
} from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';
import BisSourceBadge from './BisSourceBadge';

export default function RecommendationCard({ 
  standard, 
  isPrimary = true, 
  onViewDetails,
  onToggleCompare,
  isCompared = false,
  onSave,
  isSaved = false,
  animationIndex = 0
}) {
  const { t } = useI18n();
  const [isExpanded, setIsExpanded] = useState(false);

  const isNumber = standard.is_number || "IS Standard";
  const title = standard.title || "Indian Standard Specification";
  const score = standard.score !== undefined ? Math.round(standard.score * 100) : 85;
  const status = standard.bis_status || standard.status || "Active";
  const isCurrent = status.toLowerCase() === 'active' || status.toLowerCase() === 'current';
  
  const verification = standard.verification || {};
  const verificationSource = standard.verification_source || verification.source || "official_bis_cache";
  const rawBisUrl = standard.official_bis_url || standard.detail_url || "";
  // Ensure we only link to authentic standard-details pages, never generic search pages
  const officialBisUrl = (rawBisUrl && rawBisUrl.includes('/standard-details')) ? rawBisUrl : null;
  
  // Truthful source badges
  const isBisLive = verificationSource === 'official_bis_live' || standard.data_source === 'BIS_LIVE';
  const isLocalVerified = verificationSource === 'official_bis_cache' || standard.data_source === 'LOCAL_KNOWLEDGE_BASE';
  const isMongoCached = verificationSource === 'mongodb_cache' || standard.data_source === 'MONGODB_CACHE';

  // Why this standard snippet
  const explanation = standard.structured_explanation?.why_recommended || 
    standard.explanation || 
    `Specifies requirements, sampling, and test methods for this procurement category.`;

  // Real BIS portal metadata
  const department = standard.department || null;
  const committee = standard.technical_committee || null;
  const standardType = standard.type_of_standard || standard.category || null;
  const year = standard.year || standard.published_year || standard.reaffirmation_year || null;
  
  let certificationText = t('notAvailableFromBis');
  if (typeof standard.certification === 'string' && standard.certification.trim()) {
    certificationText = standard.certification;
  } else if (standard.certification?.mandatory === true) {
    certificationText = standard.certification?.status || standard.certification?.details || t('mandatoryQco');
  } else if (standard.certification?.mandatory === false) {
    certificationText = standard.certification?.status || standard.certification?.details || t('voluntary');
  }

  // Stagger animation delay: 50ms per card, capped at 300ms
  const staggerDelay = `${Math.min(animationIndex * 50, 300)}ms`;

  return (
    <div 
      className="search-result-card animated-result-card"
      style={{ animationDelay: staggerDelay }}
    >
      {/* Top Breadcrumb & Status Row */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        marginBottom: '6px'
      }}>
        <div className="result-breadcrumb">
          <span>Bureau of Indian Standards</span>
          <span>›</span>
          <span>{department || "Indian Standards"}</span>
          <span>›</span>
          <span className="is-code" style={{ color: 'var(--text-main)', fontWeight: 600 }}>{isNumber}</span>
        </div>

        {/* Source & Status Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span className={`badge ${isPrimary ? 'badge-blue' : 'badge-neutral'}`}>
            {isPrimary ? t('primaryBadge') : t('alliedBadge')}
          </span>

          {isCurrent ? (
            <span className="badge badge-verified">
              ● {t('currentBadge')}
            </span>
          ) : (
            <span className="badge badge-warning">
              ● {status.toUpperCase()}
            </span>
          )}

          {isBisLive && (
            <span className="badge badge-gold" title="Verified live via official BIS portal (standards.bis.gov.in)">
              ✓ {t('liveBisVerified')}
            </span>
          )}

          {!isBisLive && isLocalVerified && (
            <span className="badge badge-verified" title="Indexed from verified Indian Standards catalog">
              {t('localVerifiedIndex')}
            </span>
          )}

          {!isBisLive && !isLocalVerified && isMongoCached && (
            <span className="badge badge-blue" title="Cached in ISRA repository">
              {t('mongoCached')}
            </span>
          )}

          {!isBisLive && !isLocalVerified && !isMongoCached && (
            <span className="badge badge-warning" title="Standard details pending BIS verification">
              {t('unverified')}
            </span>
          )}

          {/* Relevance Match % */}
          <span style={{
            fontSize: '11.5px',
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            color: score >= 80 ? 'var(--status-verified)' : 'var(--primary-blue)',
            marginLeft: '4px'
          }}>
            {score}%
          </span>
        </div>
      </div>

      {/* Main Standard Title (Clickable) */}
      <div>
        <a 
          href="#view-details" 
          onClick={(e) => { e.preventDefault(); onViewDetails(standard); }}
          className="result-title"
        >
          {isNumber} : {title}
        </a>
      </div>

      {/* Rationale / Snippet */}
      <p className="result-snippet">
        {explanation}
      </p>

      {/* Structured BIS Metadata Grid */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '14px',
        padding: '8px 12px',
        background: '#F8FAFC',
        border: '1px solid var(--border-subtle)',
        borderRadius: '6px',
        fontSize: '12px',
        color: 'var(--text-secondary)',
        marginBottom: '12px'
      }}>
        {year && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Calendar size={13} color="var(--text-muted)" />
            <span>{t('year')}: <strong>{year}</strong></span>
          </div>
        )}

        {standardType && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <FileCheck size={13} color="var(--text-muted)" />
            <span>{t('type')}: <strong>{standardType}</strong></span>
          </div>
        )}

        {department && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Building2 size={13} color="var(--text-muted)" />
            <span>{t('dept')}: <strong>{department}</strong></span>
          </div>
        )}

        {committee && (
          <div>
            <span>{t('committee')}: <strong>{committee}</strong></span>
          </div>
        )}

        <div>
          <span>{t('certification')}: <strong style={{ color: certificationText.includes('Mandatory') ? '#B45309' : 'inherit' }}>{certificationText}</strong></span>
        </div>
      </div>

      {/* Technical Requirements: Safety, Test Methods & Material */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '10px',
        marginBottom: '14px'
      }}>
        {/* Safety Requirements */}
        <div style={{
          padding: '10px 12px',
          background: '#F8FAFC',
          border: '1px solid var(--border-subtle)',
          borderRadius: '6px',
          fontSize: '12px'
        }}>
          <div style={{
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            marginBottom: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}>
            <ShieldCheck size={12} color="var(--status-verified)" />
            <span>{t('safetyRequirements')}</span>
          </div>
          {Array.isArray(standard.safety_standards) && standard.safety_standards.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {standard.safety_standards.map((saf, i) => (
                <span key={i} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-main)', fontWeight: 500 }}>
                  {typeof saf === 'object' ? (saf.is_number || saf.title) : saf}
                </span>
              ))}
            </div>
          ) : standard.scope && /safety|protection|ingress|hazard|flame|shock/i.test(standard.scope) ? (
            <span style={{ color: 'var(--text-secondary)', lineHeight: 1.4, display: 'block' }}>
              {standard.scope.length > 120 ? standard.scope.slice(0, 120) + '...' : standard.scope}
            </span>
          ) : (
            <span style={{ color: 'var(--text-light)', fontStyle: 'italic' }}>
              {t('notAvailableFromBis')}
            </span>
          )}
        </div>

        {/* Test Measurements / Requirements */}
        <div style={{
          padding: '10px 12px',
          background: '#F8FAFC',
          border: '1px solid var(--border-subtle)',
          borderRadius: '6px',
          fontSize: '12px'
        }}>
          <div style={{
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            marginBottom: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '5px'
          }}>
            <FlaskConical size={12} color="var(--primary-blue)" />
            <span>{t('testMeasurementsMethods')}</span>
          </div>
          {Array.isArray(standard.test_methods) && standard.test_methods.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {standard.test_methods.map((tm, i) => (
                <span key={i} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-main)', fontWeight: 500 }}>
                  {typeof tm === 'object' ? (tm.is_number || tm.title) : tm}
                </span>
              ))}
            </div>
          ) : (
            <span style={{ color: 'var(--text-light)', fontStyle: 'italic' }}>
              {t('notAvailableFromBis')}
            </span>
          )}
        </div>
      </div>

      {/* Expandable Sections Toggle (References & Material) */}
      {((standard.normative_references && standard.normative_references.length > 0) || standard.scope) && (
        <div style={{ marginBottom: '14px' }}>
          <div 
            onClick={() => setIsExpanded(!isExpanded)}
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '6px', 
              fontSize: '12px', 
              color: 'var(--primary-blue)', 
              fontWeight: 600,
              cursor: 'pointer',
              userSelect: 'none'
            }}
          >
            <span>{isExpanded ? t('close') : t('tabReferred')}</span>
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>

          {isExpanded && (
            <div className="accordion-content" style={{ marginTop: '8px', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}>
              {standard.scope && (
                <div style={{ marginBottom: '8px' }}>
                  <strong style={{ color: 'var(--text-main)', fontSize: '12px' }}>{t('scopeLabel')}: </strong>
                  <span style={{ color: 'var(--text-secondary)' }}>{standard.scope}</span>
                </div>
              )}
              {standard.normative_references && standard.normative_references.length > 0 && (
                <div>
                  <strong style={{ color: 'var(--text-main)', fontSize: '12px' }}>{t('referencedStandards')}: </strong>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                    {standard.normative_references.map((ref, idx) => (
                      <span key={idx} className="is-code" style={{ background: '#F1F5F9', border: '1px solid #E2E8F0', padding: '2px 6px', borderRadius: '4px', fontSize: '11.5px' }}>
                        {ref}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Bottom Actions Bar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => onViewDetails(standard)}
            className="btn btn-primary btn-sm"
          >
            <span>{t('viewBisDetails')}</span>
            <ChevronRight size={14} />
          </button>

          {/* Official BIS Source with Authentic BIS Logo Badge */}
          {officialBisUrl && (
            <BisSourceBadge
              verified={isBisLive || isLocalVerified}
              url={officialBisUrl}
            />
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => onToggleCompare && onToggleCompare(standard)}
            className="btn btn-secondary btn-sm"
            title="Add standard to comparison table"
          >
            <Scale size={13} color={isCompared ? 'var(--primary-blue)' : 'var(--text-muted)'} />
            <span>{isCompared ? t('compared') : t('compare')}</span>
          </button>

          <button
            type="button"
            onClick={() => onSave && onSave(standard)}
            className="btn btn-secondary btn-sm"
            title="Save to session bookmarks"
          >
            <Bookmark size={13} color={isSaved ? 'var(--status-gold)' : 'var(--text-muted)'} />
            <span>{isSaved ? t('saved') : t('save')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
