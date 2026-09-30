import Docker from 'dockerode';
import { config } from '../config.js';

const docker = new Docker();

/** 容器管理器：统一负责镜像准备 + 容器生命周期，两个执行器共用 */
export class ContainerManager {
  /** 确保镜像存在，不存在则拉取 */
  async ensureImage(image: string): Promise<void> {
    const existing = await docker.listImages({ filters: { reference: [image] } });
    if (existing.length > 0) return;

    await new Promise<void>((resolve, reject) => {
      docker.pull(image, (err, stream) => {
        if (err) return reject(err);
        docker.modem.followProgress(stream, (err2) => (err2 ? reject(err2) : resolve()));
      });
    });
  }

  /** 创建并启动一个容器，返回 container 对象 */
  async create(opts: {
    image: string;
    cmd: string[];
    tty: boolean;
    networkDisabled?: boolean;
  }) {
    await this.ensureImage(opts.image);

    const container = await docker.createContainer({
      Image: opts.image,
      Cmd: opts.cmd,
      Tty: opts.tty,
      OpenStdin: true,
      StdinOnce: false,
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      HostConfig: {
        // 资源限额
        NanoCpus: config.limits.cpu * 1e9,
        Memory: config.limits.memoryBytes,
        MemorySwap: config.limits.memoryBytes,
        // 代码执行容器断网；靶机容器走默认网络
        NetworkMode: opts.networkDisabled ? 'none' : 'bridge',
        // 安全加固
        CapDrop: ['ALL'],
        ReadonlyRootfs: false,
        AutoRemove: true,
      },
    });

    await container.start();
    return container;
  }

  /** 销毁容器（强制、幂等） */
  async destroy(containerId: string): Promise<void> {
    const c = docker.getContainer(containerId);
    await c.kill().catch(() => {});
    await c.remove({ force: true }).catch(() => {});
  }

  /** 列出所有正在运行的容器（调试用） */
  async listRunning(): Promise<string[]> {
    const list = await docker.listContainers();
    return list.map((c) => c.Id);
  }
}
