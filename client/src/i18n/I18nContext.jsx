import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from './translations';

const I18nContext = createContext(null);

const STORAGE_KEY = 'isra_language';

export function I18nProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && (saved === 'en' || saved === 'te' || saved === 'hi')) {
        return saved;
      }
    } catch (_) {}
    return 'en';
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, language);
      document.documentElement.lang = language;
      document.documentElement.dir = 'ltr';
    } catch (_) {}
  }, [language]);

  /**
   * Translate key with optional parameter substitution
   * e.g. t('aboutResults', { count: 5 })
   */
  const t = (key, params = {}) => {
    const langDict = translations[language] || translations.en;
    let str = langDict[key] ?? translations.en[key] ?? key;

    if (params && typeof params === 'object') {
      Object.entries(params).forEach(([k, v]) => {
        str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      });
    }

    return str;
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return ctx;
}
