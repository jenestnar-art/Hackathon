export const config = {
  port: Number(process.env.PORT ?? 3001),
  images: {
    // 安全靶机镜像（预置漏洞 + flag）
    security: process.env.SECURITY_IMAGE ?? 'codecrossroad/security:latest',
    // 代码执行镜像（node + python）
    software: process.env.SOFTWARE_IMAGE ?? 'codecrossroad/software:latest',
    // 安全方向：攻击者终端镜像（nmap/curl/nc/python）
    attacker: process.env.ATTACKER_IMAGE ?? 'codecrossroad/attacker:latest',
    // 安全方向：靶机镜像（带漏洞的图片处理服务）
    target: process.env.TARGET_IMAGE ?? 'codecrossroad/target:latest',
  },
  limits: {
    cpu: Number(process.env.CPU_LIMIT ?? 0.5),        // 0.5 核
    memoryBytes: Number(process.env.MEMORY_LIMIT ?? 256) * 1024 * 1024, // 256MB
    timeoutSeconds: Number(process.env.TIMEOUT ?? 8), // 单次执行超时
  },
} as const;
