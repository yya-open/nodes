# 备忘录系统（Cloudflare：可登录 + 云同步）

## 功能
- 游客模式（无需账号，云端保存，只能本人访问）
- 普通用户（用户名 + 口令）
- 管理员（用户管理：创建/删除/改角色/重置口令）
- 备忘录：新增/编辑/删除、完成、置顶、标签、搜索、筛选、导入/导出

## 关键点
- 纯前端：`public/`
- 后端：Cloudflare Pages Functions：`functions/`
- 数据库：Cloudflare D1（SQLite）：`migrations/0001_init.sql`
- 鉴权：HttpOnly Cookie + HMAC 签名 token（30 天有效）

## 1) 安装 & 登录
```bash
npm i
npx wrangler login
```

## 2) 创建 D1 数据库
```bash
npx wrangler d1 create memo-cloud-db
```
把输出里的 `database_id` 复制到根目录 `wrangler.toml` 的 `database_id`。

> Wrangler 的 D1 命令参考：`wrangler d1 create / migrations apply / execute ...`

## 3) 初始化表结构（迁移）
```bash
npx wrangler d1 migrations apply memo-cloud-db --remote
```

## 4) 本地开发
```bash
npm run dev
```
默认会给你一个本地地址，用浏览器打开即可。

## 5) 部署到 Cloudflare Pages
方式一（推荐）：把仓库连到 Cloudflare Pages
- Build command：留空
- Output directory：`public`
- Functions：自动识别 `functions/`

方式二（CLI）：
```bash
npm run deploy
```

## 6) 配置环境变量（Pages -> Settings -> Environment Variables）
必填：
- `TOKEN_SECRET`：随机长字符串（建议 32+ 字符）

可选（首次部署引导创建管理员）：
- `ADMIN_BOOTSTRAP_USER`
- `ADMIN_BOOTSTRAP_PASSCODE`

说明：当数据库里还没有任何用户时，用上述用户名/口令登录，会自动创建第一个管理员账号。之后即使变量仍存在，也不会再触发。

## 7) 访问与使用
- 打开站点 -> 选择「游客模式」或用用户名口令登录
- 管理员：工具栏会出现「用户管理」


## 本地开发环境变量
在项目根目录新建 `.dev.vars`（不要提交到仓库），内容例如：
```
TOKEN_SECRET=任意长随机字符串
```
然后重启 `npm run dev`。
