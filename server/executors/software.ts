import type Dockerode from 'dockerode';
import { config } from '../config.js';
import type { RunCodeRequest, RunResult } from '../types.js';

/**
 * 软件执行器：把用户代码写进容器临时文件，真执行，回传 stdout/stderr。
 * 断网 + 限时 + 限内存，防死循环和恶意代码。
 */
export async function runCode(opts: {
  container: Dockerode.Container;
  req: RunCodeRequest;
}): Promise<RunResult> {
  const { req, container } = opts;

  // 代码 base64 编码后写进文件，避免引号/换行破坏 shell 命令
  const encoded = Buffer.from(req.code, 'utf-8').toString('base64');
  const fileName = req.lang === 'js' ? '/tmp/code.js' : '/tmp/code.py';
  const runner = req.lang === 'js' ? 'node /tmp/code.js' : 'python3 /tmp/code.py';

  const exec = await container.exec({
    Cmd: ['/bin/sh', '-c', `echo ${encoded} | base64 -d > ${fileName} && ${runner}`],
    AttachStdout: true,
    AttachStderr: true,
  });

  const stream = await exec.start({ hijack: true, stdin: false });

  let output = '';
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    // 超时直接强杀容器，中断死循环
    container.kill().catch(() => {});
  }, config.limits.timeoutSeconds * 1000);

  await new Promise<void>((resolve) => {
    stream.on('data', (chunk: Buffer) => {
      output += chunk.toString('utf-8');
    });
    stream.on('end', resolve);
    stream.on('error', resolve);
  });

  clearTimeout(timer);

  const inspect = await exec.inspect().catch(() => null);
  return {
    output,
    exitCode: inspect?.ExitCode ?? null,
    timedOut,
  };
}

/** 代码执行容器规格：断网（network none） */
export const softwareSpec = {
  image: config.images.software,
  cmd: ['/bin/sh'],
  tty: false,
  networkDisabled: true,
} as const;
