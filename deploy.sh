#!/bin/bash
# 服务器一键部署脚本
# 使用方法: chmod +x deploy.sh && ./deploy.sh

set -e

echo "🎯 Goal Tracker 部署开始..."

# 检查 .env
if [ ! -f backend/.env ]; then
    echo "❌ backend/.env 不存在！请先创建："
    echo "   cp backend/.env.example backend/.env"
    echo "   然后编辑 backend/.env 填入 DEEPSEEK_API_KEY"
    exit 1
fi

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装，请先安装 Docker"
    echo "   curl -fsSL https://get.docker.com | sh"
    exit 1
fi

# 构建并启动
echo "📦 构建镜像..."
docker compose build --no-cache

echo "🚀 启动服务..."
docker compose up -d

echo ""
echo "✅ 部署完成！"
echo "   访问 http://$(hostname -I | awk '{print $1}')"
echo ""
echo "📋 常用命令："
echo "   docker compose logs -f      查看日志"
echo "   docker compose restart      重启服务"
echo "   docker compose down         停止服务"
echo "   docker compose up -d --build  重新构建并启动"
