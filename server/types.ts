// 后端内部类型
export type ExecutorKind = 'security' | 'software';

export interface RunCodeRequest {
  lang: 'js' | 'py';
  code: string;
}

export interface RunResult {
  output: string;
  exitCode: number | null;
  timedOut: boolean;
}
