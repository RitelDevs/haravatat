import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Database } from './db.js';
import { requireUser } from './auth.js';
import { HttpError } from './errors.js';
import { blogThemeSchema, readBlogTheme } from '../shared/blog-theme.js';
export function blogRoutes(app: FastifyInstance, db: Database) {
  app.get('/api/blogs/:login', async (request) => {
    const { login } = z.object({ login: z.string().min(1).max(100) }).parse(request.params);
    const { rows } = await db.query(
      'SELECT u.login,u.name,u.avatar_url,t.settings FROM users u LEFT JOIN blog_themes t ON t.user_id=u.id WHERE lower(u.login)=lower($1) ORDER BY u.id LIMIT 1',
      [login],
    );
    if (!rows[0]) throw new HttpError(404, '博客不存在');
    const { settings, ...author } = rows[0];
    return { blog: { ...author, theme: readBlogTheme(settings) } };
  });
  app.get('/api/account/theme', async (request) => {
    const user = await requireUser(db, request);
    const { rows } = await db.query('SELECT settings FROM blog_themes WHERE user_id=$1', [user.id]);
    return { theme: readBlogTheme(rows[0]?.settings) };
  });
  app.put('/api/account/theme', async (request) => {
    const user = await requireUser(db, request);
    const theme = blogThemeSchema.parse(request.body);
    await db.transaction(async (tx) => {
      await tx.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [user.id]);
      await requireUser(tx, request);
      await tx.query(
        'INSERT INTO blog_themes (user_id,settings) VALUES ($1,$2::jsonb) ON CONFLICT (user_id) DO UPDATE SET settings=excluded.settings',
        [user.id, JSON.stringify(theme)],
      );
    });
    return { theme };
  });
}
