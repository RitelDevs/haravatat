import { useEffect, useSyncExternalStore } from 'react';
import { preferredLanguage, translate, translateMessage, type Language } from '../../shared/i18n';
export { translateMessage } from '../../shared/i18n';
const listeners = new Set<() => void>();
let locale: Language =
  typeof document === 'undefined' ? 'zh-CN' : preferredLanguage(document.documentElement.lang);
export const language = () => locale;
export const t = (key: string, values: unknown[] = []) => translate(key, values, locale);
export const number = (value: number, options?: Intl.NumberFormatOptions) =>
  new Intl.NumberFormat(locale, options).format(value);
export const message = (value: string) => translateMessage(value, locale);
export function setLanguage(next: Language) {
  locale = next;
  document.documentElement.lang = next;
  document
    .querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')
    .forEach((input) => input.setCustomValidity(''));
  try {
    localStorage.setItem('haravatat-language', next);
  } catch {
    /* Selection still works in this tab. */
  }
  for (const listener of listeners) listener();
}
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const useLanguage = () => useSyncExternalStore(subscribe, language, () => 'zh-CN' as const);
export function LanguageSelector() {
  const selected = useLanguage();
  useEffect(() => {
    const invalid = (event: Event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) return;
      input.setCustomValidity('');
      if (!input.validity.valid)
        input.setCustomValidity(
          t(input.validity.valueMissing ? '请填写此字段。' : '请输入有效值。'),
        );
    };
    const clear = (event: Event) => {
      const input = event.target;
      if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)
        input.setCustomValidity('');
    };
    document.addEventListener('invalid', invalid, true);
    document.addEventListener('input', clear, true);
    return () => {
      document.removeEventListener('invalid', invalid, true);
      document.removeEventListener('input', clear, true);
    };
  }, []);
  return (
    <label className="appearance">
      <span>{t('语言')}</span>
      <select
        aria-label={t('语言')}
        value={selected}
        onChange={(event) => setLanguage(event.target.value as Language)}
      >
        <option value="zh-CN">简体中文</option>
        <option value="en">English</option>
      </select>
    </label>
  );
}
