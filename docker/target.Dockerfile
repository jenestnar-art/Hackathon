FROM debian:bookworm-slim

# 靶机：Python 图片处理服务 + 提权所需组件
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    bash \
    coreutils \
    file \
    findutils \
    imagemagick \
    netcat-openbsd \
    python3 \
    sudo \
  && rm -rf /var/lib/apt/lists/*

# 低权用户 webadmin：服务以其身份运行，shell 拿到后先到这一层
RUN useradd --create-home --shell /bin/bash webadmin

# 提权口：webadmin 可以无密码以 root 运行 find
RUN echo "webadmin ALL=(root) NOPASSWD: /usr/bin/find" > /etc/sudoers.d/webadmin \
  && chmod 440 /etc/sudoers.d/webadmin

WORKDIR /srv/app
COPY target/app.py /srv/app/app.py

# 给侦察阶段准备的“线索”文件
RUN mkdir -p /srv/app/backup \
  && cp /srv/app/app.py /srv/app/backup/app.py.bak \
  && printf 'ADMIN_EMAIL=ops@pixelforge.local\nAPI_PORT=8080\n' > /srv/app/backup/.env \
  && chown -R webadmin:webadmin /srv/app

USER webadmin
EXPOSE 8000 8080
CMD ["python3", "/srv/app/app.py"]
