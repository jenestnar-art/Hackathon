# 代码岔路口 · Code Crossroads

让计算机新生通过四个浏览器内的短关卡，亲手试一遍软件工程、网络安全、人工智能和嵌入式，最终得到方向画像与职业建议。

当前阶段已经完成：

- 登录页与演示登录状态
- 登录后的方向选择主页
- 四个方向的统一数据配置
- 四个方向的通用工作台占位路由

## 启动

```bash
pnpm install
pnpm dev
```

打开终端中显示的地址，默认是 `http://localhost:5173`。

演示账号：`admin`，密码：`passwd`。

## 构建检查

```bash
pnpm lint
pnpm build
```

## 目录结构

```text
src/
├── app/
│   └── App.tsx                 # 应用入口、路由与登录状态切换
├── components/
│   ├── BrandMark.tsx           # 品牌标识
│   └── TrackCard.tsx           # 方向卡片
├── data/
│   └── tracks.ts               # 四个方向的统一配置
├── features/
│   └── auth/
│       └── authStore.ts        # 当前演示登录状态
├── pages/
│   ├── LoginPage.tsx           # 登录页
│   ├── HomePage.tsx            # 方向选择主页
│   └── TrackPlaceholderPage.tsx# 四方向工作台占位页
├── styles/
│   └── app.css                 # 应用级样式与动效
├── index.css                   # Tailwind 与全局基础样式
└── main.tsx                    # React 挂载入口
```

`server/` 保留为后续真实执行引擎的骨架，当前前端演示不依赖 Docker 或后端服务。
