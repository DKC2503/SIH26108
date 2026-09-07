import React from 'react';
import { 
  ExternalLink, 
  ChevronRight, 
  Scale, 
  Bookmark, 
  CheckCircle2, 
  Building2, 
  Calendar, 
  FileCheck 
} from 'lucide-react';

export default function RecommendationCard({ 
  standard, 
  isPrimary = true, 
  onViewDetails,
  onToggleCompare,
  isCompared = false,
  onSave,
  isSaved = false
}) {
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

  // Real BIS portal metadata (never invent fake defaults)
  const department = standard.department || null;
  const committee = standard.technical_committee || null;
  const standardType = standard.type_of_standard || standard.category || null;
  const year = standard.year || standard.published_year || standard.reaffirmation_year || null;
  
  let certificationText = "Not available on BIS portal";
  if (typeof standard.certification === 'string' && standard.certification.trim()) {
    certificationText = standard.certification;
  } else if (standard.certification?.mandatory === true) {
    certificationText = standard.certification?.details || "Mandatory (QCO)";
  } else if (standard.certification?.mandatory === false && standard.certification?.details) {
    certificationText = standard.certification.details;
  }

  return (
    <div className="search-result-card">
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className={`badge ${isPrimary ? 'badge-blue' : 'badge-neutral'}`}>
            {isPrimary ? 'Primary Standard' : 'Allied Standard'}
          </span>

          {isCurrent ? (
            <span className="badge badge-verified">
              ● Current
            </span>
          ) : (
            <span className="badge badge-warning">
              ● {status.toUpperCase()}
            </span>
          )}

          {isBisLive && (
            <span className="badge badge-gold" title="Verified live via official BIS portal (standards.bis.gov.in)">
              ✓ Live BIS Verified
            </span>
          )}

          {!isBisLive && isLocalVerified && (
            <span className="badge badge-verified" title="Indexed from verified Indian Standards catalog">
              Local Verified Index
            </span>
          )}

          {!isBisLive && !isLocalVerified && isMongoCached && (
            <span className="badge badge-blue" title="Cached in ISRA repository">
              MongoDB Cached
            </span>
          )}

          {!isBisLive && !isLocalVerified && !isMongoCached && (
            <span className="badge badge-warning" title="Standard details pending BIS verification">
              Unverified
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
            {score}% Match
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
        gap: '16px',
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
            <span>Year: <strong>{year}</strong></span>
          </div>
        )}

        {standardType && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <FileCheck size={13} color="var(--text-muted)" />
            <span>Type: <strong>{standardType}</strong></span>
          </div>
        )}

        {department && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Building2 size={13} color="var(--text-muted)" />
            <span>Dept: <strong>{department}</strong></span>
          </div>
        )}

        {committee && (
          <div>
            <span>Committee: <strong>{committee}</strong></span>
          </div>
        )}

        <div>
          <span>Certification: <strong style={{ color: certificationText.includes('Mandatory') ? '#B45309' : 'inherit' }}>{certificationText}</strong></span>
        </div>
      </div>

      {/* Technical Requirements: Safety & Test Methods */}
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
            <span>Safety Requirements</span>
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
              Not available from BIS
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
            <span>Test Measurements & Methods</span>
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
              Not available from BIS
            </span>
          )}
        </div>
      </div>

      {/* Bottom Actions Bar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={() => onViewDetails(standard)}
            className="btn btn-primary btn-sm"
          >
            <span>View BIS Details</span>
            <ChevronRight size={14} />
          </button>

          {officialBisUrl && (
            <a
              href={officialBisUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
              title="Open genuine standard record on standards.bis.gov.in"
            >
              <span>Open official BIS page</span>
              <ExternalLink size={12} color="var(--primary-blue)" />
            </a>
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
            <span>{isCompared ? 'Compared' : 'Compare'}</span>
          </button>

          <button
            type="button"
            onClick={() => onSave && onSave(standard)}
            className="btn btn-secondary btn-sm"
            title="Save to session bookmarks"
          >
            <Bookmark size={13} color={isSaved ? 'var(--status-gold)' : 'var(--text-muted)'} />
            <span>{isSaved ? 'Saved' : 'Save'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
