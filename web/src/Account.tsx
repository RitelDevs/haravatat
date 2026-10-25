import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from './App';
import { api, errorMessage, type User } from './api';
import { t, message, number, useLanguage } from './i18n';
interface AccountData {
  user: User;
  sources: number;
  files: number;
  posts: number;
}
export function Account() {
  useLanguage();
  const { user, loading } = useAuth();
  const [data, setData] = useState<AccountData | null>(null);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const load = async () => {
    try {
      setData(await api<AccountData>('/api/account'));
      setError('');
    } catch (error) {
      setError(errorMessage(error));
    }
  };
  useEffect(() => {
    if (user) void load();
  }, [user]);
  if (loading) return <main className="page empty">{t('连接中…')}</main>;
  if (!user)
    return (
      <main className="page empty">
        <h1>{t('账号管理')}</h1>
        <p>{t('请先通过 GitHub 登录')}</p>
        <a className="button" href="/auth/github">
          {t('GitHub 登录 ')}
        </a>
      </main>
    );
  return (
    <main className="page account-page">
      <Link to="/dashboard">{t('我的工作台')}</Link>
      <h1>{t('账号管理')}</h1>
      <p>
        <Link className="button" to="/account/theme">
          {t('博客主题')}
        </Link>{' '}
        <Link to={`/?author=${encodeURIComponent(user.login)}`}>{t('查看我的博客')}</Link>
      </p>
      <section className="account-panel" aria-label={t('GitHub 身份')}>
        <h2>{t('GitHub 身份')}</h2>
        <dl>
          <dt>{t('用户名')}</dt>
          <dd>{user.login}</dd>
          <dt>{t('显示名称')}</dt>
          <dd>{user.name}</dd>
          <dt>GitHub ID</dt>
          <dd>{user.id}</dd>
        </dl>
        <p className="muted">{t('用户名、名称及头像来自 GitHub，下次登录时更新。')}</p>
        {data && (
          <p>
            {t('本站数据：{0} 个工作区，{1} 个文件，{2} 篇文章。', [
              number(data.sources),
              number(data.files),
              number(data.posts),
            ])}
          </p>
        )}
      </section>
      {error && (
        <div role="alert">
          {message(error)}{' '}
          <button onClick={load} disabled={busy}>
            {t('重新连接')}
          </button>
        </div>
      )}
      <section className="account-panel danger-zone" aria-label={t('注销账号')}>
        <h2>{t('注销账号')}</h2>
        <p>
          {t(
            '退出登录仅结束当前会话。注销账号将永久删除全部工作区、源文件、文章、文章资源和保存的仓库凭据，并使全部会话失效。',
          )}
        </p>
        <p>
          {t(
            '公开文章及资源立即下线；已被他人下载的副本无法收回。GitHub 账号及远程仓库不受影响。再次登录将创建空白账号。',
          )}
        </p>
        {!confirming ? (
          <button className="danger" onClick={() => setConfirming(true)}>
            {t('注销本站账号')}
          </button>
        ) : (
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (busy || confirmation !== user.login) return;
              setBusy(true);
              setError('');
              try {
                await api('/api/account', { method: 'DELETE', body: { confirmation } });
                window.location.assign('/?account=deleted');
              } catch (error) {
                setError(errorMessage(error));
                setBusy(false);
              }
            }}
          >
            <p id="delete-account-warning">
              {t('此操作无法撤销。输入 GitHub 用户名 {0} 确认注销。', [user.login])}
            </p>
            <label>
              {t('确认用户名')}
              <input
                autoFocus
                autoComplete="off"
                aria-describedby="delete-account-warning"
                required
                value={confirmation}
                disabled={busy}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </label>
            <div className="actions">
              <button
                className="danger"
                type="submit"
                disabled={busy || confirmation !== user.login}
              >
                {t(busy ? '正在注销…' : '永久删除本站账号')}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setConfirming(false);
                  setConfirmation('');
                  setError('');
                }}
              >
                {t('取消')}
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
