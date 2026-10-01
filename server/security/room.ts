import { randomBytes, randomUUID } from 'node:crypto';
import { PassThrough, type Duplex, type Readable } from 'node:stream';
import Docker from 'dockerode';
import type Dockerode from 'dockerode';
import { config } from '../config.js';
import { ContainerManager } from '../docker/manager.js';
import { getSecurityHint, getSecurityHintCount, type SecurityHint } from './hints.js';

const docker = new Docker();
const manager = new ContainerManager();

const ROOM_TTL_MS = 25 * 60 * 1000;
const TOOL_PATTERN = /\b(nmap|curl|gobuster|ffuf|nc|netcat|whoami|id|hostname|sudo|find|cat)\b/g;
const TARGET_INFO_PATTERN = /TARGET:\s*\d{1,3}(?:\.\d{1,3}){3}/i;

export type SecurityStage = 'brief' | 'recon' | 'foothold' | 'root';

export interface SecurityRoom {
  id: string;
  networkName: string;
  attackerId: string;
  targetId: string;
  targetIp: string;
  attackerIp: string;
  userFlag: string;
  rootFlag: string;
  hintsUsed: number;
  footholdAt: number | null;
  serverControlledAt: number | null;
  userFlagAt: number | null;
  rootFlagAt: number | null;
  toolsUsed: Set<string>;
  createdAt: number;
  ttl: NodeJS.Timeout;
}

export interface RoomShell {
  input: Duplex;
  output: Readable;
  resize: (rows: number, cols: number) => Promise<void>;
}

const rooms = new Map<string, SecurityRoom>();

function makeFlag(prefix: string): string {
  return `CROSSROADS{${prefix}_${randomBytes(12).toString('hex')}}`;
}

function makeSubnet(seed: string): { subnet: string; gateway: string } {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const second = 10 + (hash % 200);
  const third = (hash >>> 8) % 256;
  return { subnet: `10.${second}.${third}.0/24`, gateway: `10.${second}.${third}.1` };
}

function ipAt(subnet: string, host: number): string {
  const base = subnet.slice(0, subnet.lastIndexOf('.'));
  return `${base}.${host}`;
}

async function ensureNetwork(name: string, subnet: string, gateway: string) {
  const existing = await docker.listNetworks({ filters: { name: [name] } });
  if (existing.length > 0) return docker.getNetwork(name);

  return docker.createNetwork({
    Name: name,
    Driver: 'bridge',
    Internal: true,
    IPAM: {
      Driver: 'default',
      Config: [{ Subnet: subnet, Gateway: gateway }],
    },
  });
}

async function execIn(
  container: Dockerode.Container,
  opts: { cmd: string[]; user?: string },
): Promise<string> {
  const exec = await container.exec({
    Cmd: opts.cmd,
    AttachStdout: true,
    AttachStderr: true,
    Tty: false,
    User: opts.user,
  });

  const stream = (await exec.start({ hijack: true, stdin: false })) as Duplex;
  const outputStream = demuxOutput(stream);
  let outputText = '';

  await new Promise<void>((resolve, reject) => {
    outputStream.on('data', (chunk: Buffer) => {
      outputText += chunk.toString('utf-8');
    });
    outputStream.on('end', resolve);
    outputStream.on('error', reject);
  });

  const inspect = await exec.inspect().catch(() => null);
  if (inspect && inspect.ExitCode !== 0) {
    throw new Error(outputText.trim() || `exec exited ${inspect.ExitCode}`);
  }

  return outputText;
}

/** Docker exec 返回复用帧；先移除 8 字节头，避免控制字符污染 xterm。 */
function demuxOutput(stream: Duplex): Readable {
  const output = new PassThrough();
  let ended = false;
  const finish = () => {
    if (ended) return;
    ended = true;
    output.end();
  };

  docker.modem.demuxStream(stream, output, output);
  stream.on('end', finish);
  stream.on('close', finish);
  stream.on('error', (err) => {
    if (!ended) output.destroy(err);
  });
  return output;
}

async function seedFlags(
  container: Dockerode.Container,
  userFlag: string,
  rootFlag: string,
): Promise<void> {
  // 低权用户可读的 user flag
  await execIn(container, {
    cmd: ['/bin/sh', '-c', `printf '%s' '${userFlag}' > /home/webadmin/user.txt`],
    user: 'webadmin',
  });

  // 只有 root 能读的 root flag
  await execIn(container, {
    cmd: ['/bin/sh', '-c', `printf '%s' '${rootFlag}' > /root/root.txt`],
    user: 'root',
  });
}

async function openShell(
  container: Dockerode.Container,
  cmd: string[],
): Promise<RoomShell> {
  const exec = await container.exec({
    Cmd: cmd,
    AttachStdin: true,
    AttachStdout: true,
    AttachStderr: true,
    Env: ['TERM=xterm-256color'],
    Tty: true,
  });

  const input = (await exec.start({ hijack: true, stdin: true })) as Duplex;
  await exec.resize({ h: 30, w: 110 }).catch(() => {});
  return {
    input,
    output: demuxOutput(input),
    resize: async (rows, cols) => {
      await exec.resize({ h: rows, w: cols });
    },
  };
}

async function createRoomOnce(attempt: number): Promise<SecurityRoom> {
  const id = randomUUID().slice(0, 12);
  const networkName = `cx-sec-${id}`;
  const { subnet, gateway } = makeSubnet(`${id}-${attempt}`);
  const attackerIp = ipAt(subnet, 2);
  const targetIp = ipAt(subnet, 4);
  const attackerId = `cx-attacker-${id}`;
  const targetId = `cx-target-${id}`;

  let attacker: Dockerode.Container | undefined;
  let target: Dockerode.Container | undefined;
  let networkCreated = false;

  try {
    await ensureNetwork(networkName, subnet, gateway);
    networkCreated = true;

    attacker = await manager.createUnstarted({
      image: config.images.attacker,
      cmd: ['/bin/bash', '-l'],
      tty: true,
      networkDisabled: true,
      networkName,
      staticIp: attackerIp,
      name: attackerId,
      workingDir: '/workspace',
    });

    target = await manager.createUnstarted({
      image: config.images.target,
      cmd: ['python3', '/srv/app/app.py'],
      tty: false,
      networkDisabled: true,
      networkName,
      staticIp: targetIp,
      // 靶机故意保留 sudo/setuid 提权链；网络仍隔离，限额仍生效
      allowPrivilegeEscalation: true,
      // sudo 切换 root 需要 SETUID/SETGID，审计插件还需要 AUDIT_WRITE；其余能力仍全部丢弃
      capAdd: ['SETUID', 'SETGID', 'AUDIT_WRITE'],
      name: targetId,
      workingDir: '/srv/app',
    });

    await attacker.start();
    await target.start();

    const userFlag = makeFlag('user');
    const rootFlag = makeFlag('root');
    await seedFlags(target, userFlag, rootFlag);

    const room: SecurityRoom = {
      id,
      networkName,
      attackerId,
      targetId,
      targetIp,
      attackerIp,
      userFlag,
      rootFlag,
      hintsUsed: 0,
      footholdAt: null,
      serverControlledAt: null,
      userFlagAt: null,
      rootFlagAt: null,
      toolsUsed: new Set<string>(),
      createdAt: Date.now(),
      ttl: setTimeout(() => {
        void destroyRoom(id);
      }, ROOM_TTL_MS),
    };

    rooms.set(id, room);
    return room;
  } catch (err) {
    if (attacker) await manager.destroy(attacker.id).catch(() => {});
    if (target) await manager.destroy(target.id).catch(() => {});
    if (networkCreated) await docker.getNetwork(networkName).remove().catch(() => {});
    throw err;
  }
}

export async function createRoom(): Promise<SecurityRoom> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await createRoomOnce(attempt);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

export function getRoom(id: string): SecurityRoom | undefined {
  return rooms.get(id);
}

export async function destroyRoom(id: string): Promise<void> {
  const room = rooms.get(id);
  if (!room) return;

  rooms.delete(id);
  clearTimeout(room.ttl);

  await Promise.all([
    manager.destroy(room.attackerId).catch(() => {}),
    manager.destroy(room.targetId).catch(() => {}),
  ]);

  await docker.getNetwork(room.networkName).remove().catch(() => {});
}

export async function openRoomShell(
  room: SecurityRoom,
  cmd: string[] = ['/bin/bash', '-l'],
): Promise<RoomShell> {
  const container = docker.getContainer(room.attackerId);
  return openShell(container, cmd);
}

export async function openRoomListener(room: SecurityRoom): Promise<RoomShell> {
  return openRoomShell(room, [
    '/bin/bash',
    '-lc',
    'while true; do echo "listening on 0.0.0.0:4444 ..."; nc -lvnp 4444; done',
  ]);
}

export function consumeHint(
  room: SecurityRoom,
): { hint: SecurityHint; hintsUsed: number; maxHints: number } | null {
  if (room.hintsUsed >= getSecurityHintCount()) return null;

  const hint = getSecurityHint(room.hintsUsed, room.targetIp);
  if (!hint) return null;

  room.hintsUsed += 1;
  return {
    hint,
    hintsUsed: room.hintsUsed,
    maxHints: getSecurityHintCount(),
  };
}

export function submitFlag(
  room: SecurityRoom,
  flag: string,
): { ok: boolean; level?: 'user' | 'root' } {
  const normalized = flag.trim();
  if (normalized === room.userFlag) {
    room.userFlagAt ??= Date.now();
    return { ok: true, level: 'user' };
  }
  if (normalized === room.rootFlag) {
    room.rootFlagAt ??= Date.now();
    return { ok: true, level: 'root' };
  }
  return { ok: false };
}

export function scanRoomOutput(room: SecurityRoom, chunk: Buffer | string): void {
  const text = Buffer.isBuffer(chunk) ? chunk.toString('utf-8') : chunk;

  // 快速侦察提示直接输出目标信息，等价于完成一次 nmap 侦察。
  if (TARGET_INFO_PATTERN.test(text)) {
    room.toolsUsed.add('nmap');
  }

  // 拿到低权 shell：反向 shell 连接建立，或出现 webadmin@ 提示符
  if (/\bwebadmin@|connection received/i.test(text)) {
    room.footholdAt ??= Date.now();
  }

  // 控制服务器：必须在 root shell 中实际运行 id，看到 uid=0(root) 后才算完成
  if (/uid=0\(root\)/.test(text)) {
    room.serverControlledAt ??= Date.now();
  }

  let match: RegExpExecArray | null;
  TOOL_PATTERN.lastIndex = 0;
  while ((match = TOOL_PATTERN.exec(text)) !== null) {
    room.toolsUsed.add(match[1].toLowerCase());
  }
}

export function getProgress(room: SecurityRoom): {
  stage: SecurityStage;
  targetIp: string;
  toolsUsed: string[];
  hintsUsed: number;
  foothold: boolean;
  serverControlled: boolean;
  userFlagDone: boolean;
  rootFlagDone: boolean;
  elapsedMs: number;
} {
  const tools = [...room.toolsUsed];
  let stage: SecurityStage = 'brief';

  if (room.serverControlledAt) stage = 'root';
  else if (room.footholdAt) stage = 'foothold';
  else if (tools.some((tool) => ['nmap', 'curl', 'gobuster', 'ffuf'].includes(tool))) {
    stage = 'recon';
  }

  return {
    stage,
    targetIp: room.targetIp,
    toolsUsed: tools,
    hintsUsed: room.hintsUsed,
    foothold: Boolean(room.footholdAt),
    serverControlled: Boolean(room.serverControlledAt),
    userFlagDone: Boolean(room.userFlagAt),
    rootFlagDone: Boolean(room.rootFlagAt),
    elapsedMs: Date.now() - room.createdAt,
  };
}
