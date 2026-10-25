import { defaultBlogTheme, readBlogTheme, type BlogTheme } from '../../shared/blog-theme';
export function themeAttributes(value?: BlogTheme) {
  const theme = readBlogTheme(value ?? defaultBlogTheme);
  return {
    'data-blog-palette': theme.palette,
    'data-blog-font': theme.font,
    'data-blog-layout': theme.layout,
    'data-blog-cover': theme.cover,
  };
}
