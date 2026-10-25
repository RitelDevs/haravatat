import { t, useLanguage, LanguageSelector, message } from './i18n';
import { createContext, useContext, useEffect, useState } from 'react';
import { BrowserRouter, Link, NavLink, Route, Routes } from 'react-router-dom';
import { api, type User, errorMessage } from './api';
import { Home, Article } from './Reading';
import { Appearance } from './Appearance';
import { Dashboard } from './Dashboard';
const Auth = createContext<{
  user: User | null;
  loading: boolean;
  configured: boolean;
  refresh: () => Promise<void>;
}>({ user: null, loading: true, configured: false, refresh: async () => {} });
export const useAuth = () => useContext(Auth);
export function App() {
  const locale = useLanguage();
  useEffect(() => {
    if (!location.pathname.startsWith('/p/')) document.title = t('Haravatat · 知识与文字');
  }, [locale]);
  const [user, setUser] = useState<User | null>(null),
    [loading, setLoading] = useState(true),
    [configured, setConfigured] = useState(false),
    [error, setError] = useState('');
  const refresh = async () => {
    try {
      const result = await api<{ user: User | null; loginConfigured: boolean }>('/api/me');
      setUser(result.user);
      setConfigured(result.loginConfigured);
      setError('');
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void refresh();
  }, []);
  const logout = async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
      await refresh();
    } catch (error) {
      setError(errorMessage(error));
    }
  };
  return (
    <Auth.Provider value={{ user, loading, configured, refresh }}>
      <BrowserRouter>
        <header className="site-header">
          <div className="header-inner">
            <Link className="brand" to="/" aria-label={t('Haravatat 首页')}>
              <span className="brand-symbol">h.</span>
              <span>
                Haravatat<small>{t('知识与文字')}</small>
              </span>
            </Link>
            <nav>
              <NavLink to="/" end>
                {t('发现')}
              </NavLink>
              <NavLink to="/dashboard">{t('我的工作台')}</NavLink>
            </nav>
            <LanguageSelector />
            <Appearance />
            <div className="account">
              {loading ? (
                <span className="muted">{t('连接中…')}</span>
              ) : user ? (
                <>
                  <img src={user.avatar_url} alt="" />
                  <span className="account-name">{user.login}</span>
                  <button className="text-button" onClick={logout}>
                    {t('退出')}
                  </button>
                </>
              ) : (
                <a className="button small" href="/auth/github">
                  {t('GitHub 登录 ')}
                  <span aria-hidden="true">↗</span>
                </a>
              )}
            </div>
          </div>
        </header>
        {error && (
          <div className="global-error" role="alert">
            {message(error)} <button onClick={refresh}>{t('重新连接')}</button>
          </div>
        )}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/p/:id" element={<Article />} />
          <Route
            path="*"
            element={
              <main className="page empty">
                <h1>{t('页面不存在')}</h1>
                <Link to="/">{t('返回首页')}</Link>
              </main>
            }
          />
        </Routes>
        <footer className="site-footer">
          <span>Haravatat</span>
          <span>{t('写下思考，让知识相遇。')}</span>
          <span>Typst & Markdown</span>
        </footer>
      </BrowserRouter>
    </Auth.Provider>
  );
}
