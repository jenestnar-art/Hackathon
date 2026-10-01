import type { FastifyInstance } from 'fastify';
import type { WebSocket } from '@fastify/websocket';
import {
  consumeHint,
  createRoom,
  destroyRoom,
  getProgress,
  getRoom,
  openRoomListener,
  openRoomShell,
  scanRoomOutput,
  submitFlag,
} from '../security/room.js';
import type { RoomShell } from '../security/room.js';

interface PendingMessage {
  data: Buffer;
  isBinary: boolean;
}

function rawDataToBuffer(data: unknown): Buffer {
  if (typeof data === 'string') return Buffer.from(data);
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  if (Array.isArray(data)) return Buffer.concat(data.map((part) => rawDataToBuffer(part)));
  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  }
  return Buffer.alloc(0);
}

async function bridgeShell(
  app: FastifyInstance,
  socket: WebSocket,
  openShell: () => Promise<RoomShell>,
  onOutput: (chunk: Buffer) => void,
  failureMessage: string,
): Promise<void> {
  const pending: PendingMessage[] = [];
  let shell: RoomShell | null = null;

  const forward = (data: unknown, isBinary: boolean): void => {
    const activeShell = shell;
    const buffer = rawDataToBuffer(data);
    if (buffer.length === 0) return;

    if (!activeShell) {
      pending.push({ data: buffer, isBinary });
      return;
    }

    if (!isBinary) {
      try {
        const message = JSON.parse(buffer.toString('utf-8')) as {
          type?: string;
          rows?: number;
          cols?: number;
        };
        if (message.type === 'resize' && Number.isInteger(message.rows) && Number.isInteger(message.cols)) {
          const rows = Math.min(300, Math.max(1, message.rows ?? 1));
          const cols = Math.min(500, Math.max(1, message.cols ?? 1));
          void activeShell.resize(rows, cols).catch((err) => app.log.warn(err, 'resize PTY failed'));
          return;
        }
      } catch {
        // 兼容旧前端发送的纯文本输入。
      }
    }

    activeShell.input.write(buffer);
  };

  socket.on('message', (data: unknown, isBinary: boolean) => forward(data, isBinary));

  try {
    shell = await openShell();
    const activeShell = shell;

    // WebSocket 可能先于 docker exec 就绪，先缓存输入再按原顺序转发。
    for (const message of pending) forward(message.data, message.isBinary);
    pending.length = 0;

    activeShell.output.on('data', (chunk: Buffer) => {
      onOutput(chunk);
      socket.send(chunk);
    });
    activeShell.output.on('end', () => socket.close());
    activeShell.output.on('error', () => socket.close());
    socket.on('close', () => activeShell.input.destroy());
  } catch (err) {
    app.log.error(err);
    socket.close(4001, failureMessage);
  }
}

export async function securityRoutes(app: FastifyInstance): Promise<void> {
  // 创建安全靶机房间（攻击者 + 靶机双容器）
  app.post('/security/session', async (_req, reply) => {
    try {
      const room = await createRoom();
      return { sessionId: room.id, targetIp: room.targetIp };
    } catch (err) {
      app.log.error(err);
      return reply
        .status(500)
        .send({ error: '靶机环境创建失败，请确认 Docker 已启动并已构建镜像' });
    }
  });

  // 进度与画像数据
  app.get('/security/session/:id/progress', async (req, reply) => {
    const { id } = req.params as { id: string };
    const room = getRoom(id);
    if (!room) return reply.status(404).send({ error: 'session 不存在' });
    return getProgress(room);
  });

  // 渐进式提示
  app.post('/security/session/:id/hint', async (req, reply) => {
    const { id } = req.params as { id: string };
    const room = getRoom(id);
    if (!room) return reply.status(404).send({ error: 'session 不存在' });

    const result = consumeHint(room);
    if (!result) return reply.status(409).send({ error: '提示已全部用完' });
    return result;
  });

  // 提交 Flag
  app.post('/security/session/:id/flag', async (req, reply) => {
    const { id } = req.params as { id: string };
    const room = getRoom(id);
    if (!room) return reply.status(404).send({ error: 'session 不存在' });

    const { flag } = (req.body ?? {}) as { flag?: string };
    if (!flag || typeof flag !== 'string') {
      return reply.status(400).send({ error: '需要 flag' });
    }

    const result = submitFlag(room, flag);
    if (!result.ok) return reply.status(400).send({ ok: false, error: 'Flag 不正确' });
    return result;
  });

  // 攻击者终端
  app.get('/security/session/:id/term', { websocket: true }, async (socket, req) => {
    const { id } = req.params as { id: string };
    const room = getRoom(id);
    if (!room) return socket.close(4000, 'session 不存在');

    await bridgeShell(
      app,
      socket,
      () => openRoomShell(room),
      (chunk) => scanRoomOutput(room, chunk),
      '终端启动失败',
    );
  });

  // 监听器终端
  app.get('/security/session/:id/listener', { websocket: true }, async (socket, req) => {
    const { id } = req.params as { id: string };
    const room = getRoom(id);
    if (!room) return socket.close(4000, 'session 不存在');

    await bridgeShell(
      app,
      socket,
      () => openRoomListener(room),
      (chunk) => scanRoomOutput(room, chunk),
      '监听器启动失败',
    );
  });

  // 销毁房间
  app.delete('/security/session/:id', async (req, _reply) => {
    const { id } = req.params as { id: string };
    await destroyRoom(id);
    return { ok: true };
  });
}
