(() => {
  let saved;
  try {
    saved = localStorage.getItem('haravatat-language');
  } catch {
    /* Use browser preference. */
  }
  const browser = navigator.languages || [navigator.language];
  document.documentElement.lang =
    saved === 'en' || saved === 'zh-CN'
      ? saved
      : browser
          .map((value) => value.toLowerCase())
          .map((value) =>
            /^en(?:-|$)/.test(value) ? 'en' : /^zh(?:-|$)/.test(value) ? 'zh-CN' : null,
          )
          .find(Boolean) || 'zh-CN';
})();
