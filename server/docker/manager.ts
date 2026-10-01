import Docker from 'dockerode';
import type Dockerode from 'dockerode';
import { config } from '../config.js';

const docker = new Docker();

/** 容器管理器：统一负责镜像准备 + 容器生命周期，两个执行器共用 */
export class ContainerManager {
  /** 确保镜像存在，不存在则拉取 */
  async ensureImage(image: string): Promise<void> {
    const existing = await docker.listImages({ filters: { reference: [image] } });
    if (existing.length > 0) return;

    await new Promise<void>((resolve, reject) => {
      docker.pull(image, (err: Error | null, stream: NodeJS.ReadableStream) => {
        if (err) return reject(err);
        docker.modem.followProgress(stream, (err2: Error | null) =>
          err2 ? reject(err2) : resolve(),
        );
      });
    });
  }

  /** 创建容器但不启动（供需要先接入自定义网络的场景使用） */
  async createUnstarted(opts: {
    image: string;
    cmd: readonly string[];
    tty: boolean;
    networkDisabled?: boolean;
    networkName?: string;
    staticIp?: string;
    allowPrivilegeEscalation?: boolean;
    capAdd?: string[];
    name?: string;
    workingDir?: string;
  }): Promise<Dockerode.Container> {
    await this.ensureImage(opts.image);

    const networkMode = opts.networkName ?? (opts.networkDisabled ? 'none' : 'bridge');
    const endpoints = opts.networkName
      ? {
          [opts.networkName]: opts.staticIp
            ? { IPAMConfig: { IPv4Address: opts.staticIp } }
            : {},
        }
      : undefined;

    return docker.createContainer({
      Image: opts.image,
      Cmd: [...opts.cmd],
      Tty: opts.tty,
      OpenStdin: true,
      StdinOnce: false,
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      name: opts.name,
      WorkingDir: opts.workingDir,
      NetworkingConfig: endpoints ? { EndpointsConfig: endpoints } : undefined,
      HostConfig: {
        // 资源限额
        NanoCpus: config.limits.cpu * 1e9,
        Memory: config.limits.memoryBytes,
        MemorySwap: config.limits.memoryBytes,
        // 默认断网；安全房间通过 networkName 接入内部网络
        NetworkMode: networkMode,
        // 安全加固
        CapDrop: ['ALL'],
        ...(opts.capAdd?.length ? { CapAdd: opts.capAdd } : {}),
        ReadonlyRootfs: false,
        AutoRemove: true,
        PidsLimit: 128,
        // 靶机需要保留 setuid 提权路径；攻击者容器保持 no-new-privileges
        ...(opts.allowPrivilegeEscalation ? {} : { SecurityOpt: ['no-new-privileges'] }),
      },
    });
  }

  /** 创建并启动一个容器，返回 container 对象 */
  async create(opts: {
    image: string;
    cmd: readonly string[];
    tty: boolean;
    networkDisabled?: boolean;
  }): Promise<Dockerode.Container> {
    const container = await this.createUnstarted(opts);
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
