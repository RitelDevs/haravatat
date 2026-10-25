import english from './translations.json';
export type Language = 'zh-CN' | 'en';
const translations: Record<string, string> = english;
export function preferredLanguage(value: string | undefined): Language {
  for (const entry of (value || '').split(',')) {
    const [tag, ...parameters] = entry.trim().toLowerCase().split(';');
    if (parameters.some((parameter) => /^q=0(?:\.0*)?$/.test(parameter.trim()))) continue;
    if (/^zh(?:-|$)/.test(tag)) return 'zh-CN';
    if (/^en(?:-|$)/.test(tag)) return 'en';
  }
  return 'zh-CN';
}
export function translate(key: string, values: unknown[] = [], locale: Language = 'zh-CN') {
  const message = locale === 'en' ? (translations[key] ?? key) : key;
  return message.replace(/\{(\d+)\}/g, (token, index: string) =>
    String(values[Number(index)] ?? token),
  );
}
// Only application-generated status and error strings enter this boundary.
export function translateMessage(message: string, locale: Language): string {
  for (const [source, target] of Object.entries(translations)) {
    for (const candidate of [source, target]) {
      if (candidate === message) return locale === 'en' ? target : source;
      if (!/\{\d+\}/.test(candidate)) continue;
      const pattern = candidate
        .split(/\{\d+\}/)
        .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join(String.raw`([\s\S]*?)`);
      const match = new RegExp(`^${pattern}$`).exec(message);
      if (match) return translate(source, match.slice(1), locale);
    }
  }
  return message;
}
