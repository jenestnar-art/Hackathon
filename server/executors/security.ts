import type { Duplex } from 'node:stream';
import type Dockerode from 'dockerode';
import { config } from '../config.js';

/**
 * 安全执行器：拉起靶机容器，返回一个可读写的 shell 流。
 * 前端 xterm.js 通过 WebSocket 连进来，双向桥接。
 */
export async function startSecurityShell(opts: {
  container: Dockerode.Container;
}): Promise<Duplex> {
  // 在容器里开一个交互式 bash（PTY）
  const exec = await opts.container.exec({
    Cmd: ['/bin/bash', '-l'],
    AttachStdin: true,
    AttachStdout: true,
    AttachStderr: true,
    Tty: true,
  });

  const stream = (await exec.start({ hijack: true, stdin: true })) as Duplex;

  // 设置终端尺寸（可选，先给个默认）
  await exec.resize({ h: 30, w: 100 }).catch(() => {});

  return stream;
}

/** 安全靶机容器规格（网络不隔离，走 bridge，因为要真扫端口/联网） */
export const securitySpec = {
  image: config.images.security,
  cmd: ['/bin/bash', '-l'],
  tty: true,
  networkDisabled: false,
} as const;
