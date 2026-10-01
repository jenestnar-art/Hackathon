# AGENTS.md — CodeCrossroad（代码岔路口）

## 项目定位

让计算机新生通过四个方向（软件工程 / 网络安全 / 人工智能 / 嵌入式）的浏览器内短关卡，
亲手试一遍真实操作，最终得到方向画像 + 职业建议。
不是问卷，是「先做一遍，再告诉你像哪种人」。每关 5–8 分钟。
最终的成品要能够和真实场景基本一致，把真实性和可实操性放到第一位

## 四个方向的实现策略

| 方向 | 体验 | 实现 | 真实度 |
|------|------|------|--------|
| 软件工程 | 补完小项目，跑出可分享 Demo | 前端 Monaco + 预览；后端真执行代码 | 真执行 |
| 网络安全 | 攻破靶机，拿 user / root flag | 后端 Docker 双容器（attacker + target）+ WebSocket 真终端 | 真执行 |
| 人工智能 | 亲手训练一个模型 | 前端 TensorFlow.js，浏览器内真训练 | 浏览器真训练 |
| 嵌入式 | 点亮灯 / OLED 显示 | Wokwi iframe 仿真 | 浏览器仿真 |

**架构铁律：浏览器只做渲染，真实能力来自后端执行引擎。**
- 软件 / 安全：前端 → HTTP / WebSocket → 后端 Fastify → Docker 容器
- AI / 嵌入式：纯浏览器，零后端，断网可跑
- 真执行必须保留降级思路：Docker 不可用时给出明确报错，不静默失败

## 技术栈

- 前端：React 19 + TypeScript + Vite + Tailwind v4 + Zustand + react-router-dom v7
- 前端库：framer-motion、recharts、lucide-react、@monaco-editor/react、@xterm/xterm、@tensorflow/tfjs、@dnd-kit
- 后端：Node + Fastify + @fastify/websocket + dockerode（`server/`）
- 容器：Docker（`docker/` 下 attacker / target 镜像）
- 数据：Supabase（Postgres + 匿名登录，尚未接入）
- 路径别名：`@` → `src/`（见 vite.config.ts）

## 目录结构

```text
src/                              # 前端
├── app/App.tsx                   # 入口：路由 + 登录状态切换
├── pages/                        # 页面：登录 / 主页 / 方向工作台
├── components/                   # BrandMark、TrackCard 等通用组件
├── data/tracks.ts                # 四个方向的统一配置（单一数据源）
├── features/                     # 按功能划分
│   ├── auth/                     # 演示登录状态
│   └── security/                 # 安全方向：终端、API 封装
└── styles/                       # 应用样式

server/                           # 后端执行引擎
├── index.ts                      # 入口：注册插件 + 路由 + 监听
├── config.ts                     # 端口 / 镜像 / 资源限额
├── types.ts                      # 后端类型
├── docker/manager.ts             # 容器管理器（镜像 / 创建 / 销毁 / 限额）
├── executors/                    # security（交互式 shell）、software（代码执行）
├── routes/                       # session（软件）、security（靶机房间）
└── security/                     # 房间状态机、提示、进度

docker/                           # 镜像
├── build.sh                      # 构建 attacker + target 镜像
├── attacker.Dockerfile
└── target.Dockerfile
```

## 常用命令

```bash
pnpm dev              # 前端开发服务器（默认 http://localhost:5173）
pnpm dev:server       # 后端执行引擎（tsx watch，端口 3001）
pnpm docker:build     # 构建安全方向的两个 Docker 镜像
pnpm lint             # oxlint
pnpm build            # 前端构建（tsc -b && vite build）
pnpm typecheck:server # 后端类型检查（tsc -p tsconfig.server.json）
```

## 约定

- **全栈 TypeScript**，前后端共享类型，不引入第二门语言。
- **单一数据源**：四个方向的元信息统一放 `src/data/tracks.ts`，不要在页面里重复硬编码。
- **前端不直接碰 Docker**：所有真执行都经后端 HTTP / WebSocket。
- **AI / 嵌入式纯浏览器**：不依赖后端，断网可跑。
- **密钥只放服务端**：Claude / Supabase key 绝不进前端代码或日志。
- **安全方向容器必须限流**：CPU / 内存限额 + 超时强杀；代码执行容器断网。
- 演示账号：`admin` / `passwd`（当前为前端演示登录，未接真实鉴权）。

## 开发纪律

- 改代码前先读相关模块，理解现有架构与命名再动手；不臆造 API。
- 小步改动，按功能目录分地盘，避免大范围重写。
- 完成后至少跑 `pnpm lint`；涉及后端跑 `pnpm typecheck:server`；涉及构建跑 `pnpm build`。
- 涉及 Docker 的改动，说明需先 `pnpm docker:build` 且 Docker 守护进程在运行。
- 不擅自提交 / 推送，除非明确要求。
