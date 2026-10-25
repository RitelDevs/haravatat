import { z } from 'zod';
export const blogThemeSchema = z
  .object({
    version: z.literal(1),
    palette: z.enum(['forest', 'ocean', 'plum']),
    font: z.enum(['serif', 'sans']),
    layout: z.enum(['cards', 'list']),
    cover: z.enum(['none', 'gradient']),
  })
  .strict();
export type BlogTheme = z.infer<typeof blogThemeSchema>;
export const defaultBlogTheme: BlogTheme = {
  version: 1,
  palette: 'forest',
  font: 'serif',
  layout: 'cards',
  cover: 'none',
};
export function readBlogTheme(value: unknown): BlogTheme {
  const parsed = blogThemeSchema.safeParse(value);
  return parsed.success ? parsed.data : { ...defaultBlogTheme };
}
