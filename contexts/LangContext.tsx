'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { translations, Lang, T } from '@/lib/loan-i18n';

interface LangContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: T;
}

const LangContext = createContext<LangContextValue>({
  lang: 'th',
  setLang: () => {},
  t: translations.th,
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('th');

  useEffect(() => {
    const saved = localStorage.getItem('loan_lang') as Lang | null;
    if (saved === 'en' || saved === 'th') setLangState(saved);
  }, []);

  function setLang(l: Lang) {
    setLangState(l);
    localStorage.setItem('loan_lang', l);
  }

  return (
    <LangContext.Provider value={{ lang, setLang, t: translations[lang] }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}

export function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <div className="flex gap-0.5 bg-slate-700 rounded-lg p-0.5">
      <button
        onClick={() => setLang('th')}
        className={`px-2.5 py-1 rounded text-xs font-bold transition-colors ${lang === 'th' ? 'bg-yellow-600 text-white' : 'text-slate-400 hover:text-white'}`}
      >
        TH
      </button>
      <button
        onClick={() => setLang('en')}
        className={`px-2.5 py-1 rounded text-xs font-bold transition-colors ${lang === 'en' ? 'bg-yellow-600 text-white' : 'text-slate-400 hover:text-white'}`}
      >
        EN
      </button>
    </div>
  );
}
