# 未寄 · 情绪档案

Next.js App Router + TypeScript 的静态情感互动社区。默认无需后端即可运行，昵称身份、帖子、点赞和评论会保存在当前浏览器的 `localStorage` 中。

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

1. 在 Supabase SQL Editor 执行 `supabase/schema.sql`。
2. 将 `.env.example` 复制为 `.env.local`，填入项目 URL 和 anon key。
3. 重新启动 Next.js。

未配置变量或云端暂时不可用时，数据服务会平滑回退到浏览器本地存储。昵称身份是刻意设计的轻量体验，不等同于安全认证；公开上线并需要严格的跨设备所有权保护时，应把写入、删除和点赞操作改为 Supabase Auth + RPC/Edge Function。
