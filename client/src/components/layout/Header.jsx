import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, 
  X, 
  Upload, 
  Globe,
  ChevronDown
} from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';

export default function Header({ 
  query = '', 
  setQuery, 
  onSearch, 
  onClear, 
  hasResults = false,
  isLoading = false,
  onUploadClick
}) {
  const { language, setLanguage, t } = useI18n();
  const [isLangOpen, setIsLangOpen] = useState(false);
  const langDropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (langDropdownRef.current && !langDropdownRef.current.contains(e.target)) {
        setIsLangOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSearch && onSearch();
    }
  };

  const languageLabels = {
    en: 'English',
    te: 'తెలుగు',
    hi: 'हिन्दी'
  };

  return (
    <header style={{
      height: '64px',
      background: '#FFFFFF',
      borderBottom: '1px solid var(--border-subtle)',
      boxShadow: '0 1px 3px rgba(15, 23, 42, 0.03)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      position: 'sticky',
      top: 0,
      zIndex: 100
    }}>
      {/* Left: Brand / Logo */}
      <div 
        onClick={onClear} 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px', 
          cursor: 'pointer',
          userSelect: 'none'
        }}
        title="ISRA Home"
      >
        <img 
          src="/logo.png" 
          alt="ISRA" 
          style={{ 
            height: '36px', 
            width: 'auto', 
            objectFit: 'contain' 
          }} 
        />
        <div>
          <div style={{ fontSize: '18px', fontWeight: '800', letterSpacing: '-0.02em', color: 'var(--text-main)', lineHeight: 1.1 }}>
            {t('appName')}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.2, marginTop: '2px' }}>
            {t('appFullName')}
          </div>
        </div>
      </div>

      {/* Center: Search Bar (Visible when in results mode) */}
      {hasResults && (
        <div style={{ flex: 1, maxWidth: '640px', margin: '0 20px' }}>
          <div className="search-bar-compact">
            <Search size={16} color="var(--text-muted)" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery && setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('searchCompactPlaceholder')}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery && setQuery('')}
                style={{ padding: '2px', color: 'var(--text-muted)' }}
                title={t('clearQuery')}
              >
                <X size={14} />
              </button>
            )}
            <button
              type="button"
              onClick={() => onSearch && onSearch()}
              disabled={isLoading || !query.trim()}
              className="btn btn-primary btn-sm"
              style={{ padding: '4px 14px', borderRadius: '16px' }}
            >
              {t('search')}
            </button>
          </div>
        </div>
      )}

      {/* Right: Actions (Language Selector + Add Document) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        {/* Language Selector Dropdown */}
        <div className="lang-selector" ref={langDropdownRef}>
          <button
            type="button"
            className="lang-selector-trigger"
            onClick={() => setIsLangOpen(!isLangOpen)}
            title="Switch Language"
          >
            <Globe size={14} color="var(--text-secondary)" />
            <span>{languageLabels[language] || 'English'}</span>
            <ChevronDown size={13} color="var(--text-muted)" style={{ transform: isLangOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
          </button>

          {isLangOpen && (
            <div className="lang-dropdown-menu">
              <button
                type="button"
                className={`lang-dropdown-item ${language === 'en' ? 'active' : ''}`}
                onClick={() => { setLanguage('en'); setIsLangOpen(false); }}
              >
                <span>English</span>
                {language === 'en' && <span style={{ fontSize: '12px' }}>✓</span>}
              </button>
              <button
                type="button"
                className={`lang-dropdown-item ${language === 'te' ? 'active' : ''}`}
                onClick={() => { setLanguage('te'); setIsLangOpen(false); }}
              >
                <span>తెలుగు</span>
                {language === 'te' && <span style={{ fontSize: '12px' }}>✓</span>}
              </button>
              <button
                type="button"
                className={`lang-dropdown-item ${language === 'hi' ? 'active' : ''}`}
                onClick={() => { setLanguage('hi'); setIsLangOpen(false); }}
              >
                <span>हिन्दी</span>
                {language === 'hi' && <span style={{ fontSize: '12px' }}>✓</span>}
              </button>
            </div>
          )}
        </div>

        {/* Add Document button */}
        <button
          onClick={onUploadClick}
          className="btn btn-secondary btn-sm"
          style={{ gap: '6px', fontSize: '12.5px' }}
          title={t('addDocument')}
        >
          <Upload size={14} color="var(--primary-blue)" />
          <span>{t('addDocument')}</span>
        </button>
      </div>
    </header>
  );
}
