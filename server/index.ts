import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { config } from './config.js';
import { securityRoutes } from './routes/security.js';
import { sessionRoutes } from './routes/session.js';

const app = Fastify({ logger: true });

// 注册 WebSocket 插件
await app.register(websocket);

// 注册会话路由（软件方向）
await app.register(sessionRoutes);

// 注册安全靶机房间路由
await app.register(securityRoutes);

// 健康检查
app.get('/health', async () => ({ ok: true, time: Date.now() }));

// 启动
try {
  await app.listen({ port: config.port, host: '0.0.0.0' });
  console.log(`✅ 后端执行引擎已启动: http://localhost:${config.port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
