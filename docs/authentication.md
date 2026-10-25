# GitHub 登录与会话

使用 GitHub OAuth authorization-code 流程，服务端生成随机 state 和 PKCE S256 challenge；state 的哈希与 verifier 只存 PostgreSQL，浏览器通过 HttpOnly Cookie 绑定 state。回调验证匹配、有效期并一次性消耗记录，再交换 token 和查询 /user。以 GitHub 数字 ID 作为用户主键，不依赖可修改的用户名。

应用只需要公开身份，不申请 repo scope。GitHub token 不持久化、不发给浏览器。登录后生成全新随机会话，数据库只保存哈希，有效期 30 天；退出立即删除。Cookie 为 HttpOnly / SameSite=Lax，HTTPS 时设置 Secure。

开发 OAuth 回调填写 http://localhost:5173/auth/github/callback，生产填写 APP_ORIGIN/auth/github/callback；Vite 转发 /auth 到 API。

所有写请求必须携带匹配 APP_ORIGIN 的 Origin 和 X-Haravatat-Request: 1 请求头。无 CORS 授权；JSON 和 multipart 上传都使用相同保护。只读端点不改变用户文件或发布状态。登录入口额外限制请求频率。

API：GET /api/me，GET /auth/github，GET /auth/github/callback，POST /auth/logout。生产必须正确配置 HTTPS，反向代理保留 Cookie 并转发 /api 和 /auth。

验证：集成测试使用 PGlite（PostgreSQL WASM 引擎）执行真实 SQL，覆盖 state 浏览器绑定、PKCE 参数、一次性回调、会话哈希、CSRF 和退出。测试逐文件运行以限制 WASM 内存占用。

私有仓库通过同步时输入 PAT 访问，也可由用户显式保存为服务器端加密凭据；GitHub 登录 token 和仓库 PAT 用途分离，登录不申请 repo scope。未来增加文章权限时可在公开 posts 查询与媒体端点统一加入权限校验，不能只限制阅读页。

持久化 PAT 使用独立 CREDENTIAL_ENCRYPTION_KEY 和 AES-256-GCM，用户名与 token 一起加密，绑定工作区、所属用户及仓库地址；只向所有者返回是否已保存的状态。同步时才解密并传入 Git 子进程内存。凭据管理接口与文件管理使用相同会话、CSRF、用户归属校验，详见 files.md。GitHub OAuth 的登录 token 仍不持久化，不作为仓库 PAT 使用。

## 账号管理与注销

登录后的用户名链接进入 `/account`，展示 GitHub ID、用户名、名称和本站工作区、文件、文章数量（`GET /api/account`）。身份资料来自 GitHub，重新登录时刷新；不在本站编辑。页首“退出登录”只撤销当前会话，保留账号和数据。

注销需先展开确认表单，再逐字输入当前 GitHub 用户名并提交 `DELETE /api/account`，请求体仅接受 `{ confirmation: string }`。取消不会发出删除请求。接口从会话确定当前用户，不接受目标用户 ID；与其他写接口一样要求 Origin 和 X-Haravatat-Request。失败显示错误并保留确认内容，可重试；成功后清除 Cookie 并回到首页。

用户删除及级联清理在单一数据库事务内完成：全部会话、工作区、目录、源文件（含分块）、发布文章、PDF、文章资源和加密仓库凭据全部删除。任一步失败会回滚，因此不会提前清除 Cookie 或宣告成功。公开文章、PDF、资源接口随即返回 404；旧会话返回未登录。应用的 API 均使用 no-store；已经下载、在打开页面内存中保留的内容及运维备份不可能通过本站注销远程收回，备份按部署者的保留策略到期清理。

持久化的用户内容全部存于 PostgreSQL，没有额外的用户文件目录或对象存储。Git 同步和原生 Typst 编译使用临时目录并在 finally 中删除；远程编译服务执行同样的临时目录清理。已开始的同步/编译可能运行至完成，但提交时重新锁定原工作区，已被删除则失败，不能重建文章或文件。工作区新建与注销都锁定用户记录，并在锁后重新验证原会话，避免注销后重新登录时旧请求创建数据。共享 Typst 包缓存只存第三方依赖包，不保留用户源文件、PDF 或凭据，不按账号清除。

注销不会删除 GitHub 账号或远程仓库，也不会向 GitHub 发出删除请求。再次以同一 GitHub 数字 ID 登录会创建空白本站账号；旧会话仍失效，旧工作区与文章不会恢复。
