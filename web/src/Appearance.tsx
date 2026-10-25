import { t, useLanguage } from './i18n';
import { useEffect, useState } from 'react';

type ColorMode = 'light' | 'dark' | 'system';
export function Appearance() {
  useLanguage();
  const [mode, setMode] = useState<ColorMode>(() => {
    const saved = document.documentElement.dataset.colorMode;
    return saved === 'light' || saved === 'dark' ? saved : 'system';
  });
  useEffect(() => {
    const system = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const theme = mode === 'system' ? (system.matches ? 'dark' : 'light') : mode;
      document.documentElement.dataset.colorMode = mode;
      document.documentElement.dataset.theme = theme;
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', theme === 'dark' ? '#19231e' : '#f7f7f2');
    };
    apply();
    system.addEventListener('change', apply);
    return () => system.removeEventListener('change', apply);
  }, [mode]);
  return (
    <label className="appearance">
      <span>{t('显示模式')}</span>
      <select
        aria-label={t('显示模式')}
        value={mode}
        onChange={(event) => {
          const next = event.target.value as ColorMode;
          setMode(next);
          try {
            localStorage.setItem('haravatat-color-mode', next);
          } catch {
            /* Keep this tab usable without storage. */
          }
        }}
      >
        <option value="system">{t('跟随系统')}</option>
        <option value="light">{t('亮色')}</option>
        <option value="dark">{t('暗色')}</option>
      </select>
    </label>
  );
}
