import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Markdown from 'react-markdown';
import { defaultBlogTheme, type BlogTheme } from '../../shared/blog-theme';
import { api, errorMessage } from './api';
import { useAuth } from './App';
import { t, message, useLanguage } from './i18n';
import { themeAttributes } from './BlogTheme';
import { markdownPlugins, htmlPlugins } from './markdown-config';
export function BlogSettings() {
  useLanguage();
  const { user, loading: authLoading } = useAuth();
  const [theme, setTheme] = useState<BlogTheme>({ ...defaultBlogTheme });
  const [saved, setSaved] = useState<BlogTheme | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    api<{ theme: BlogTheme }>('/api/account/theme', { signal: controller.signal })
      .then(({ theme }) => {
        if (!controller.signal.aborted) {
          setTheme(theme);
          setSaved(theme);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(errorMessage(error));
      });
    return () => controller.abort();
  }, [user]);
  const dirty = JSON.stringify(theme) !== JSON.stringify(saved);
  const save = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await api<{ theme: BlogTheme }>('/api/account/theme', {
        method: 'PUT',
        body: theme,
      });
      setSaved(result.theme);
      setTheme(result.theme);
      setNotice('博客主题已保存，访问者现在可以看到。');
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  if (authLoading) return <main className="page empty">{t('连接中…')}</main>;
  if (!user)
    return (
      <main className="page empty">
        <h1>{t('博客主题')}</h1>
        <a href="/auth/github">{t('请先通过 GitHub 登录')}</a>
      </main>
    );
  return (
    <main className="page theme-settings">
      <Link to="/account">{t('账号管理')}</Link>
      <h1>{t('博客主题')}</h1>
      <p>{t('设置仅作用于你的博客首页和文章页。预览不会影响访问者，保存后生效。')}</p>
      {error && (
        <p className="notice error" role="alert">
          {message(error)} <button onClick={() => window.location.reload()}>{t('重新连接')}</button>
        </p>
      )}
      {notice && (
        <p className="notice success" role="status">
          {t(notice)}
        </p>
      )}
      <form
        className="theme-controls"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <fieldset disabled={busy || !saved}>
          <legend>{t('主题配置')}</legend>
          <label>
            {t('配色')}
            <select
              aria-label={t('配色')}
              value={theme.palette}
              onChange={(event) => {
                setTheme({ ...theme, palette: event.target.value as BlogTheme['palette'] });
                setNotice('');
              }}
            >
              <option value="forest">{t('森林')}</option>
              <option value="ocean">{t('海洋')}</option>
              <option value="plum">{t('梅紫')}</option>
            </select>
          </label>
          <label>
            {t('阅读字体')}
            <select
              aria-label={t('阅读字体')}
              value={theme.font}
              onChange={(event) => {
                setTheme({ ...theme, font: event.target.value as BlogTheme['font'] });
                setNotice('');
              }}
            >
              <option value="serif">{t('衬线')}</option>
              <option value="sans">{t('无衬线')}</option>
            </select>
          </label>
          <label>
            {t('首页布局')}
            <select
              aria-label={t('首页布局')}
              value={theme.layout}
              onChange={(event) => {
                setTheme({ ...theme, layout: event.target.value as BlogTheme['layout'] });
                setNotice('');
              }}
            >
              <option value="cards">{t('卡片')}</option>
              <option value="list">{t('列表')}</option>
            </select>
          </label>
          <label>
            {t('封面')}
            <select
              aria-label={t('封面')}
              value={theme.cover}
              onChange={(event) => {
                setTheme({ ...theme, cover: event.target.value as BlogTheme['cover'] });
                setNotice('');
              }}
            >
              <option value="none">{t('无封面')}</option>
              <option value="gradient">{t('渐变')}</option>
            </select>
          </label>
          <div className="theme-actions">
            <button className="button" type="submit" disabled={!dirty}>
              {t(busy ? '保存中…' : '保存主题')}
            </button>
            <button
              type="button"
              onClick={() => {
                setTheme({ ...defaultBlogTheme });
                setNotice('');
              }}
            >
              {t('恢复默认预览')}
            </button>
            <button
              type="button"
              disabled={!dirty}
              onClick={() => {
                if (saved) setTheme({ ...saved });
                setNotice('');
              }}
            >
              {t('撤销预览修改')}
            </button>
          </div>
        </fieldset>
      </form>
      <p className="muted">{t('恢复默认后仍需保存。字体使用设备本地字体，PDF 保留原始排版。')}</p>
      <p>
        <Link to={`/?author=${encodeURIComponent(user.login)}`}>{t('查看我的博客')}</Link>
      </p>
      <section
        aria-label={t('主题预览')}
        className="blog-theme theme-preview"
        {...themeAttributes(theme)}
      >
        <header className="blog-profile blog-cover">
          <p className="eyebrow">{t('主题预览')}</p>
          <h2>{user.name}</h2>
          <p>@{user.login}</p>
        </header>
        <div className="post-grid">
          {[1, 2].map((id) => (
            <article className="post-card" key={id}>
              <span className="format-badge">MARKDOWN</span>
              <h3>{t('思考与公式')}</h3>
              <p className="muted">{t('文章卡片预览')}</p>
            </article>
          ))}
        </div>
        <article className="markdown-body">
          <Markdown
            remarkPlugins={markdownPlugins}
            rehypePlugins={htmlPlugins}
            skipHtml
          >{`## ${t('思考与公式')}

${t('文字记录思考，公式表达规律。')}

$$ E = mc^2 $$

> ${t('预览中的示例不会发布为文章。')}`}</Markdown>
        </article>
      </section>
    </main>
  );
}
