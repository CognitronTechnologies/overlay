'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { setLocale } from './actions/locale';
import Flag from './Flag';
import {
  locales,
  localeNames,
  localeLabels,
  type Locale,
} from '../i18n/config';

/** Country flag shown next to each locale (nearest well-known flag). */
const localeFlags: Record<Locale, string> = {
  en: 'gb',
  fr: 'fr',
  es: 'es',
  pt: 'pt',
  de: 'de',
  nl: 'nl',
  zh: 'cn',
  tr: 'tr',
};

/**
 * Language selector shown in the header. Persists the choice via the setLocale
 * server action (NEXT_LOCALE cookie) and revalidates so the whole app re-renders
 * in the chosen language — no page reload, no URL change.
 */
export default function LanguageSwitcher() {
  const active = useLocale() as Locale;
  const t = useTranslations('language');
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function choose(loc: Locale) {
    setOpen(false);
    if (loc === active) return;
    startTransition(() => {
      void setLocale(loc);
    });
  }

  return (
    <div className="lang-switch" ref={ref}>
      <button
        type="button"
        className="lang-switch__trigger"
        aria-label={t('select')}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
        disabled={pending}
      >
        <Flag code={localeFlags[active]} className="lang-switch__flag" />
        <span className="lang-switch__code">{localeLabels[active]}</span>
        <svg
          className="lang-switch__chevron"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open ? (
        <div className="lang-switch__menu" role="menu" aria-label={t('label')}>
          {locales.map((loc) => (
            <button
              key={loc}
              type="button"
              role="menuitemradio"
              aria-checked={loc === active}
              className={
                loc === active
                  ? 'lang-switch__item is-active'
                  : 'lang-switch__item'
              }
              onClick={() => choose(loc)}
            >
              <Flag code={localeFlags[loc]} className="lang-switch__flag" />
              <span className="lang-switch__item-name">
                {localeNames[loc]}
              </span>
              {loc === active ? (
                <svg
                  className="lang-switch__check"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
