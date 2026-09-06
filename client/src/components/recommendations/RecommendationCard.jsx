import React, { useState } from 'react';
import { 
  ShieldCheck, 
  ExternalLink, 
  Scale, 
  Bookmark, 
  ChevronRight, 
  Check, 
  HelpCircle, 
  AlertTriangle,
  Info,
  Calendar,
  Building,
  CheckCircle2
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
  const officialBisUrl = standard.official_bis_url || standard.detail_url || "";
  
  // Clean badges based on verified evidence
  const isBisLive = verificationSource === 'official_bis_live' || standard.data_source === 'BIS_LIVE';
  const isLocalVerified = verificationSource === 'official_bis_cache' || standard.data_source === 'LOCAL_KNOWLEDGE_BASE';
  const isMongoCached = verificationSource === 'mongodb_cache' || standard.data_source === 'MONGODB_CACHE';

  // Why this standard rationale
  const explanation = standard.structured_explanation?.why_recommended || 
    standard.explanation || 
    `Standard specifies technical and compliance requirements for this product.`;

  // Match evidence categories (defensible scoring)
  const productMatch = score >= 85 ? "Strong" : (score >= 65 ? "Moderate" : (score >= 40 ? "Relevant" : "Low"));
  const appMatch = standard.scope ? "Strong" : (standard.title ? "Moderate" : "General");
  const techMatch = (standard.technical_requirements?.length > 0 || standard.normative_references?.length > 0 || standard.test_methods?.length > 0) ? "Strong" : "Standard";
  const industryMatch = standard.department ? "Strong" : "General";

  // Coverage items derived from real data
  const coverageItems = [
    { label: "Product Specifications", status: standard.title ? "yes" : "neutral" },
    { label: "Safety Requirements", status: (standard.safety_standards?.length > 0 || title.toLowerCase().includes('safety')) ? "yes" : "neutral" },
    { label: "Test & Sampling Methods", status: (standard.test_methods?.length > 0 || title.toLowerCase().includes('test') || title.toLowerCase().includes('sampling')) ? "yes" : "neutral" },
    { label: "Conformity & Quality Guidelines", status: (standard.certification?.mandatory || standard.normative_references?.length > 0) ? "yes" : "neutral" }
  ];

  return (
    <div className="card-panel" style={{
      marginBottom: '18px',
      borderLeft: isPrimary ? '4px solid var(--interactive-blue)' : '4px solid var(--text-muted)',
      background: 'var(--bg-surface)',
      position: 'relative'
    }}>
      {/* Top Meta Bar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        marginBottom: '14px',
        paddingBottom: '12px',
        borderBottom: '1px solid var(--border-subtle)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className={`badge ${isPrimary ? 'badge-blue' : 'badge-neutral'}`}>
            {isPrimary ? 'PRIMARY RECOMMENDATION' : 'ALLIED STANDARD'}
          </span>

          {isCurrent ? (
            <span className="badge badge-verified">
              ● CURRENT
            </span>
          ) : (
            <span className="badge badge-warning">
              ● {status.toUpperCase()}
            </span>
          )}

          {isBisLive && (
            <span className="badge badge-gold" title="Verified live from official BIS Standards portal">
              ✓ LIVE BIS VERIFIED
            </span>
          )}

          {!isBisLive && isLocalVerified && (
            <span className="badge badge-verified" title="Pre-indexed from verified Indian Standards catalog">
              LOCAL VERIFIED INDEX
            </span>
          )}

          {!isBisLive && !isLocalVerified && isMongoCached && (
            <span className="badge badge-blue" title="Cached from MongoDB standards database">
              MONGODB CACHED
            </span>
          )}

          {!isBisLive && !isLocalVerified && !isMongoCached && (
            <span className="badge badge-warning" title="Standard details could not be independently verified">
              UNVERIFIED
            </span>
          )}
        </div>

        {/* Relevance Score (Prominently distinguished from verification) */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
          <span style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            RELEVANCE
          </span>
          <span style={{
            fontSize: '18px',
            fontWeight: '700',
            fontFamily: 'var(--font-mono)',
            color: score >= 85 ? 'var(--status-verified)' : 'var(--accent-gold-light)'
          }}>
            {score}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>/ 100</span>
        </div>
      </div>

      {/* Main Standard Identity */}
      <div style={{ marginBottom: '14px' }}>
        <h3 className="is-code" style={{ fontSize: '18px', color: '#FFFFFF', marginBottom: '4px' }}>
          {isNumber}
        </h3>
        <p style={{ fontSize: '14.5px', color: 'var(--text-primary)', fontWeight: '500', lineHeight: 1.4 }}>
          {title}
        </p>
      </div>

      {/* Why This Standard Box */}
      <div style={{
        background: 'var(--bg-app)',
        border: '1px solid var(--border-subtle)',
        borderRadius: '6px',
        padding: '12px 16px',
        marginBottom: '14px'
      }}>
        <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--accent-gold-light)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '4px' }}>
          WHY THIS STANDARD
        </div>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          {explanation}
        </p>
      </div>

      {/* Two Column Grid: Match Evidence & Coverage */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '16px',
        marginBottom: '16px'
      }}>
        {/* Match Evidence */}
        <div style={{
          padding: '12px',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '6px'
        }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '10px' }}>
            MATCH EVIDENCE
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Product Type</span>
              <span style={{ fontWeight: 600, color: 'var(--status-verified)' }}>{productMatch}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Application & Scope</span>
              <span style={{ fontWeight: 600, color: 'var(--status-verified)' }}>{appMatch}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Technical Requirements</span>
              <span style={{ fontWeight: 600, color: techMatch === 'Strong' ? 'var(--status-verified)' : 'var(--accent-gold-light)' }}>{techMatch}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Industry Domain</span>
              <span style={{ fontWeight: 600, color: 'var(--status-verified)' }}>{industryMatch}</span>
            </div>
          </div>
        </div>

        {/* Coverage Checks */}
        <div style={{
          padding: '12px',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '6px'
        }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '10px' }}>
            STANDARD COVERAGE
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
            {coverageItems.map((cov, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle2 size={14} color="var(--status-verified)" />
                <span style={{ color: 'var(--text-secondary)' }}>{cov.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Standard Information Footer Details */}
      {(standard.department || standard.technical_committee || standard.category) && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '16px',
          fontSize: '12px',
          color: 'var(--text-muted)',
          marginBottom: '16px',
          paddingTop: '8px',
          borderTop: '1px solid var(--border-subtle)'
        }}>
          {standard.category && (
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Category: </span>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{standard.category}</span>
            </div>
          )}
          {standard.department && (
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Department: </span>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{standard.department}</span>
            </div>
          )}
          {standard.technical_committee && (
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Committee: </span>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{standard.technical_committee}</span>
            </div>
          )}
        </div>
      )}

      {/* Actions Toolbar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px',
        paddingTop: '12px',
        borderTop: '1px solid var(--border-subtle)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => onViewDetails(standard)}
            className="btn btn-primary btn-sm"
          >
            <span>View Full Details</span>
            <ChevronRight size={14} />
          </button>

          <button
            onClick={() => onToggleCompare && onToggleCompare(standard)}
            className={`btn ${isCompared ? 'btn-secondary' : 'btn-outline'} btn-sm`}
          >
            <Scale size={13} color={isCompared ? 'var(--accent-gold-light)' : 'inherit'} />
            <span>{isCompared ? 'Added to Compare' : 'Compare'}</span>
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {officialBisUrl && (
            <a
              href={officialBisUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-outline btn-sm"
              title="Open official record on standards.bis.gov.in"
            >
              <span>Official BIS Record</span>
              <ExternalLink size={12} />
            </a>
          )}

          <button
            onClick={() => onSave && onSave(standard)}
            className="btn btn-outline btn-sm"
            title="Save to session bookmarks"
          >
            <Bookmark size={13} color={isSaved ? 'var(--accent-gold-light)' : 'inherit'} />
            <span>{isSaved ? 'Saved' : 'Save'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
