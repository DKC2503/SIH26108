import React from 'react';
import { ExternalLink, ShieldCheck } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';

/**
 * BisSourceBadge
 * Displays verified official BIS source link with official styling.
 * Only renders when verified === true and the url is a genuine standards.bis.gov.in link.
 */
export default function BisSourceBadge({ 
  verified = false, 
  url = '', 
  customLabel = null,
  style = {} 
}) {
  const { t } = useI18n();

  // Strict check: verified must be true, and URL must be authentic standards.bis.gov.in
  const isValidBisUrl = Boolean(
    url && 
    typeof url === 'string' && 
    (url.startsWith('https://standards.bis.gov.in') || url.startsWith('http://standards.bis.gov.in'))
  );

  if (!verified || !isValidBisUrl) {
    return null;
  }

  const label = customLabel || t('officialBisResource');

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="bis-source-badge"
      title="Verified Bureau of Indian Standards official portal resource (standards.bis.gov.in)"
      style={style}
    >
      <span className="bis-source-logo-chip">
        <ShieldCheck size={12} className="bis-source-icon" />
        <span className="bis-source-logo-text">BIS</span>
      </span>
      <span className="bis-source-label">{label}</span>
      <ExternalLink size={12} className="bis-source-arrow" />
    </a>
  );
}
