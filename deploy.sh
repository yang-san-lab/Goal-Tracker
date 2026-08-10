#!/usr/bin/env bash
# Goal Tracker 服务器一键部署脚本（Ubuntu / Debian）
# 用法：sudo bash deploy.sh

set -euo pipefail

echo ""
echo "=============================================="
echo "  Goal Tracker 服务器部署"
echo "=============================================="
echo ""

if [ "$(id -u)" -ne 0 ]; then
    echo "请使用 root 运行：sudo bash deploy.sh"
    exit 1
fi

# ---------- 1. 确认域名 ----------
echo "请在域名服务商后台，先把下面这条解析记录加好："
echo ""
echo "  主机记录: @    记录类型: A    记录值: 本服务器公网 IP"
echo ""
while [ -z "${DOMAIN:-}" ]; do
    read -r -p "请输入你的域名（例如 example.com，不要带 http://）: " DOMAIN
done
DOMAIN="${DOMAIN#https://}"
DOMAIN="${DOMAIN#http://}"
DOMAIN="${DOMAIN%%/*}"

echo ""
echo "正在检查 DNS 解析..."
if command -v dig >/dev/null 2>&1; then
    DNS_IP=$(dig +short "$DOMAIN" | head -n 1 || true)
elif command -v nslookup >/dev/null 2>&1; then
    DNS_IP=$(nslookup "$DOMAIN" 2>/dev/null | awk '/^Address: /{print $2}' | head -n 1 || true)
else
    DNS_IP=""
fi

if [ -n "${DNS_IP:-}" ]; then
    echo "域名已解析到: $DNS_IP"
else
    echo "未检测到解析（可能还没生效）。请确认 DNS 已生效后再继续，否则 HTTPS 证书申请会失败。"
    read -r -p "继续部署（跳过检查）？[y/N] " SKIP_DNS
    if [ "${SKIP_DNS:-n}" != "y" ] && [ "${SKIP_DNS:-n}" != "Y" ]; then
        echo "已取消，等 DNS 生效后重新运行即可。"
        exit 1
    fi
fi

# ---------- 2. DeepSeek API Key ----------
while [ -z "${API_KEY:-}" ]; do
    read -r -p "请输入你的 DeepSeek API Key（sk- 开头）: " API_KEY
done

# ---------- 3. 安装 Docker ----------
if ! command -v docker >/dev/null 2>&1; then
    echo ""
    echo "未检测到 Docker，开始安装..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable --now docker
fi

if ! command -v docker >/dev/null 2>&1; then
    echo "Docker 安装失败，请手动安装后重试：curl -fsSL https://get.docker.com | sh"
    exit 1
fi
echo "Docker 已就绪: $(docker --version)"

# ---------- 4. 拉取项目代码 ----------
APP_DIR="/opt/goal-tracker"
if [ -d "$APP_DIR/.git" ]; then
    echo ""
    echo "项目已存在，拉取最新代码..."
    git -C "$APP_DIR" pull
else
    echo ""
    echo "开始克隆项目到 $APP_DIR ..."
    git clone https://github.com/yang-san-lab/Goal-Tracker.git "$APP_DIR"
fi
cd "$APP_DIR"

# ---------- 5. 写入环境配置 ----------
SECRET_KEY=$(tr -dc 'a-zA-Z0-9' </dev/urandom | head -c 48 || openssl rand -hex 24)
mkdir -p data
cat > backend/.env <<EOF
DATABASE_URL=sqlite:///./data/goal_tracker.db
SECRET_KEY=${SECRET_KEY}
DEEPSEEK_API_KEY=${API_KEY}
DEEPSEEK_BASE_URL=https://api.deepseek.com
AI_MODEL=deepseek-chat
EOF
chmod 600 backend/.env
echo ""
echo "环境配置已写入 backend/.env"

# ---------- 6. 启动服务 ----------
echo ""
echo "构建并启动服务（首次构建需要几分钟）..."
docker compose up -d --build

echo ""
echo "等待服务启动..."
sleep 5
docker compose ps

# ---------- 7. 安装 Nginx 和证书 ----------
echo ""
echo "安装 Nginx 和 certbot..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y nginx certbot python3-certbot-nginx

cat > /etc/nginx/sites-available/goaltracker <<EOF
server {
    listen 80;
    server_name ${DOMAIN};

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

if [ -f /etc/nginx/sites-enabled/default ]; then
    rm -f /etc/nginx/sites-enabled/default
fi
ln -sf /etc/nginx/sites-available/goaltracker /etc/nginx/sites-enabled/goaltracker
nginx -t
systemctl reload nginx

echo ""
echo "申请 HTTPS 证书（Let's Encrypt）..."
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --redirect --register-unsafely-without-email || true

echo ""
echo "=============================================="
echo " 部署完成！"
echo " 访问地址: https://${DOMAIN}"
echo " 健康检查: https://${DOMAIN}/api/health"
echo ""
echo " 常用命令:"
echo "   docker compose logs -f       查看日志"
echo "   docker compose restart       重启服务"
echo "   docker compose down          停止服务"
echo "=============================================="
echo ""
