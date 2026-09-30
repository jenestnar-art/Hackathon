import type { FastifyInstance } from 'fastify';
import type { Duplex } from 'node:stream';
import Docker from 'dockerode';
import { ContainerManager } from '../docker/manager.js';
import { securitySpec, startSecurityShell } from '../executors/security.js';
import { softwareSpec, runCode } from '../executors/software.js';
import type { RunCodeRequest } from '../types.js';

const docker = new Docker();
const manager = new ContainerManager();

/** 会话表：sessionId -> containerId */
const sessions = new Map<string, string>();

export async function sessionRoutes(app: FastifyInstance): Promise<void> {
  // 创建会话（拉起对应方向的容器）
  app.post('/session', async (req, reply) => {
    const { kind } = req.body as { kind: 'security' | 'software' };
    if (kind !== 'security' && kind !== 'software') {
      return reply.status(400).send({ error: 'kind 必须是 security 或 software' });
    }

    const spec = kind === 'security' ? securitySpec : softwareSpec;
    const container = await manager.create({
      image: spec.image,
      cmd: spec.cmd,
      tty: spec.tty,
      networkDisabled: spec.networkDisabled,
    });

    const sessionId = crypto.randomUUID();
    sessions.set(sessionId, container.id);
    return { sessionId };
  });

  // 安全方向：WebSocket 终端双向流
  app.get('/session/:id/term', { websocket: true }, async (socket, req) => {
    const { id } = req.params as { id: string };
    const containerId = sessions.get(id);
    if (!containerId) return socket.close(4000, 'session 不存在');

    const container = docker.getContainer(containerId);
    const stream: Duplex = await startSecurityShell({ container });

    socket.on('message', (data) => stream.write(data));
    stream.on('data', (chunk: Buffer) => socket.send(chunk));
    socket.on('close', () => {
      stream.destroy();
      manager.destroy(containerId);
      sessions.delete(id);
    });
  });

  // 软件方向：提交代码，真执行
  app.post('/session/:id/run', async (req, reply) => {
    const { id } = req.params as { id: string };
    const containerId = sessions.get(id);
    if (!containerId) return reply.status(404).send({ error: 'session 不存在' });

    const body = req.body as RunCodeRequest;
    if (!body.code || !['js', 'py'].includes(body.lang)) {
      return reply.status(400).send({ error: '需要 code 和 lang(js|py)' });
    }

    const container = docker.getContainer(containerId);
    const result = await runCode({ container, req: body });
    return result;
  });

  // 销毁会话
  app.delete('/session/:id', async (req, _reply) => {
    const { id } = req.params as { id: string };
    const containerId = sessions.get(id);
    if (containerId) {
      await manager.destroy(containerId);
      sessions.delete(id);
    }
    return { ok: true };
  });
}
