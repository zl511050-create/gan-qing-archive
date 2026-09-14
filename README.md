# 未寄 · 情绪档案

Next.js App Router + TypeScript 的静态情感互动社区。默认无需后端即可运行，昵称身份、登录会话、帖子、点赞和评论会保存在当前浏览器的 `localStorage` 中。

## 本地运行

```bash
npm install
npm run dev
```

构建检查：

```bash
npm run typecheck
npm run lint
npm run build
```

静态导出生成在 `out/`。

## 可选 Supabase 持久化

1. 新项目在 Supabase SQL Editor 执行 `supabase/schema.sql`；已有项目执行可重复运行的 `supabase/migrations/20260913_add_password_login.sql`。
2. 将 `.env.example` 复制为 `.env.local`，填入项目 URL 和 anon key。
3. 重新启动 Next.js。

数据库脚本会为 `users` 表添加 `password_hash` 与会话字段，为 `posts` 添加作者归属和匿名字段，并创建注册、登录、会话恢复、头像更新 RPC。四位密码与会话令牌只以哈希保存。用户登录后再次刷新、关闭后重开网页，系统会自动校验并恢复登录；断网时保留最近一次有效的本地会话。只有用户点击“退出登录”才会清除当前浏览器中的会话。

三个主题面板都是实际发帖入口。非匿名用户首次发帖时可从 8 张内置卡通头像中选择；帖子会保存昵称和头像快照，之后更换头像不会改动历史帖子。匿名发布则不会在卡片上显示昵称和头像。

未配置 Supabase 时，数据服务会回退到浏览器本地存储。本项目的四位密码是轻量身份识别方案，不等同于高安全等级认证；如需严格的账号安全、找回密码与跨设备会话管理，应升级为 Supabase Auth。
