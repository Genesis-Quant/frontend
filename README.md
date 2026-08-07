# Arena Frontend

Arena 的 React 前端。工程技术栈与目录约定参考 `E:\Eagle\eagle`：React 19、Vite 8、TypeScript、React Router、Zustand、Axios、Tailwind CSS 4、Radix UI、Motion、Less、自动导入和 Lucide 图标。

```powershell
npm install
npm run dev
npm run lint
npm run build
```

开发环境默认将 `/api` 代理到 `http://127.0.0.1:8000`。部署时可通过 `VITE_ARENA_API_URL` 指定后端 API 根路径。
