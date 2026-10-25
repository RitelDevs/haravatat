import english from './translations.json';
export type Language = 'zh-CN' | 'en';
const translations: Record<string, string> = english;
export function preferredLanguage(value: string | undefined): Language {
  const preferences = (value || '')
    .split(',')
    .map((entry) => {
      const [tag, ...parameters] = entry.trim().toLowerCase().split(';');
      const raw = parameters.find((parameter) => parameter.trim().startsWith('q='));
      const quality = raw ? Number(raw.trim().slice(2)) : 1;
      return { tag, quality };
    })
    .filter((entry) => Number.isFinite(entry.quality) && entry.quality > 0 && entry.quality <= 1)
    .sort((a, b) => b.quality - a.quality);
  for (const { tag } of preferences) {
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
      if (match) {
        const values = match.slice(1);
        // These two arguments are generated application messages. Other placeholders
        // include user paths and compiler diagnostics and must remain verbatim.
        if (
          source === '文件已上传。勾选入口后发布，线上文章才会更新。{0}' ||
          source === '自动同步未完成：{0}。已保留上次快照，可手动重试。'
        ) {
          if (values[0]) values[0] = translateMessage(values[0], locale);
        }
        return translate(source, values, locale);
      }
    }
  }
  return message;
}
