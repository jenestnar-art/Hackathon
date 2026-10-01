FROM debian:bookworm-slim

# 攻击者终端工具：侦察 / 下载 / 回连
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    bash \
    coreutils \
    curl \
    hostname \
    iproute2 \
    netcat-openbsd \
    nmap \
    procps \
    python3 \
  && rm -rf /var/lib/apt/lists/*

# 关卡演示：nmap 命令直接返回预置靶机信息，避免真实扫描等待。
RUN printf '%s\n' \
    '#!/bin/sh' \
    'target=""' \
    'for arg in "$@"; do' \
    '  case "$arg" in' \
    '    -*) ;;' \
    '    *) target="$arg" ;;' \
    '  esac' \
    'done' \
    'echo "TARGET: ${target:-unknown}"' \
    'echo "8000/tcp  open  http"' \
    'echo "8080/tcp  open  internal-api"' \
    > /usr/local/bin/nmap \
  && chmod +x /usr/local/bin/nmap

# 一个像样的终端提示符
RUN printf '%s\n' \
    'export PS1="\\[\\033[0;32m\\]operator@crossroads\\[\\033[0m\\]:\\[\\033[0;34m\\]\\w\\[\\033[0m\\]\\$ "' \
    >> /root/.bashrc

WORKDIR /workspace
CMD ["/bin/bash", "-l"]
