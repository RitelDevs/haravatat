// Run before the application and stylesheet to avoid a flash of the wrong palette.
(() => {
  let mode = 'system';
  try {
    const saved = localStorage.getItem('haravatat-color-mode');
    if (saved === 'light' || saved === 'dark') mode = saved;
  } catch {
    // Storage may be disabled; the system preference still works.
  }
  document.documentElement.dataset.colorMode = mode;
  document.documentElement.dataset.theme =
    mode === 'system'
      ? matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : mode;
})();
