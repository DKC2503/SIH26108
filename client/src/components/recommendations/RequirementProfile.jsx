import React from 'react';
import { 
  CheckCircle, 
  Tag, 
  SlidersHorizontal, 
  Layers, 
  Building2, 
  Target, 
  Globe2 
} from 'lucide-react';

export default function RequirementProfile({ requirement }) {
  if (!requirement) return null;

  const product = requirement.product || "Unspecified";
  const productType = requirement.product_type ? requirement.product_type.replace(/_/g, ' ') : "General Procurement";
  const purpose = requirement.purpose || "General procurement";
  const industry = requirement.industry || "General";
  const language = requirement.language || "English";
  const applications = requirement.applications || [];
  const technicalAttributes = requirement.technical_attributes || [];

  // Derived detected chips
  const detectedChips = [];
  if (product && product !== "Unspecified") detectedChips.push(product);
  if (productType && productType !== "unknown" && productType !== product) detectedChips.push(productType);
  if (purpose && purpose !== "general procurement") detectedChips.push(purpose);
  if (requirement.material) detectedChips.push(requirement.material);
  applications.forEach(a => detectedChips.push(a));

  return (
    <div className="card-panel" style={{ padding: '20px', marginBottom: '24px' }}>
      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <SlidersHorizontal size={17} color="var(--accent-gold-light)" />
          <h3 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--text-primary)' }}>
            Requirement Profile
          </h3>
        </div>
        <span className="badge badge-gold">Structured Extraction</span>
      </div>

      {/* Structured Fields Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: '12px',
        padding: '14px',
        background: 'var(--bg-app)',
        borderRadius: '6px',
        border: '1px solid var(--border-subtle)',
        marginBottom: '16px'
      }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Product
          </div>
          <div style={{ fontSize: '13.5px', fontWeight: '600', color: '#FFFFFF', marginTop: '2px', textTransform: 'capitalize' }}>
            {product}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Product Type
          </div>
          <div style={{ fontSize: '13.5px', fontWeight: '500', color: 'var(--text-primary)', marginTop: '2px', textTransform: 'capitalize' }}>
            {productType}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Application
          </div>
          <div style={{ fontSize: '13.5px', fontWeight: '500', color: 'var(--text-primary)', marginTop: '2px' }}>
            {applications.length > 0 ? applications.join(', ') : purpose}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Industry
          </div>
          <div style={{ fontSize: '13.5px', fontWeight: '500', color: 'var(--text-primary)', marginTop: '2px', textTransform: 'capitalize' }}>
            {industry}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Purpose
          </div>
          <div style={{ fontSize: '13.5px', fontWeight: '500', color: 'var(--text-primary)', marginTop: '2px', textTransform: 'capitalize' }}>
            {purpose}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Language
          </div>
          <div style={{ fontSize: '13.5px', fontWeight: '500', color: 'var(--text-primary)', marginTop: '2px' }}>
            {language}
          </div>
        </div>
      </div>

      {/* Detected Requirements Chips */}
      {detectedChips.length > 0 && (
        <div style={{ marginBottom: technicalAttributes.length > 0 ? '14px' : '0' }}>
          <div style={{ fontSize: '11.5px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
            Detected Requirements
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {detectedChips.map((chip, idx) => (
              <span
                key={idx}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 9px',
                  borderRadius: '14px',
                  background: 'var(--bg-surface-elevated)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '12px',
                  color: 'var(--text-primary)',
                  textTransform: 'capitalize'
                }}
              >
                <Tag size={11} color="var(--accent-gold-light)" />
                <span>{chip}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Technical Parameters (Only when extracted, never fabricated) */}
      {technicalAttributes.length > 0 && (
        <div>
          <div style={{ fontSize: '11.5px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
            Extracted Technical Parameters
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {technicalAttributes.map((attr, idx) => (
              <div
                key={idx}
                style={{
                  padding: '4px 10px',
                  borderRadius: '4px',
                  background: 'var(--interactive-blue-bg)',
                  border: '1px solid rgba(37, 99, 235, 0.25)',
                  fontSize: '12px',
                  color: '#93C5FD',
                  fontFamily: 'var(--font-mono)'
                }}
              >
                {typeof attr === 'object' ? `${attr.name || ''}: ${attr.value || ''}` : String(attr)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
