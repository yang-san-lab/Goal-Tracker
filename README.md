# 🎯 Goal Tracker —— AI 驱动的目标拆解与动态调整系统

把你的大目标交给 AI，自动拆解成每月、每周、每日的可执行任务。每天打卡反馈，AI 会根据你的实际执行情况动态调整后续计划。

**AI 引擎：DeepSeek API**（成本极低，约 1/百万元 token）

---

## 🚀 本地开发启动

### 环境准备（约 15 分钟）

- **Python 3.11+**：[下载](https://www.python.org/downloads/)
- **Node.js 20+**：[下载](https://nodejs.org/)

```bash
python --version
node --version
```

### 获取 DeepSeek API Key

1. 打开 [https://platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys)
2. 注册账号（送免费额度，之后按量付费极便宜）
3. 创建 API Key，复制 `sk-...` 开头的 Key

### 配置环境变量

```bash
cd backend
cp .env.example .env
```

编辑 `.env`，填入你的 DeepSeek API Key：

```bash
DEEPSEEK_API_KEY=sk-你的密钥
```

### 启动后端

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux

pip install -r requirements.txt
uvicorn app.main:app --reload
```

后端运行在 `http://localhost:8000`

### 启动前端

```bash
cd frontend
npm install
npm run dev
```

前端运行在 `http://localhost:5173`

手机访问：确保同一 WiFi，访问 `http://<电脑IP>:5173`

---

## ☁️ 服务器部署（Docker + 域名 + HTTPS）

这个项目已经配好 Docker，推荐用下面的流程部署到服务器。部署前需要：

- 一台 **Ubuntu / Debian** 服务器（阿里云、腾讯云、AWS 等都可以，1 核 2G 内存起步）
- 一个已经实名并完成备案（如需要）的域名
- 一个 DeepSeek API Key

### 1. 解析域名到服务器

登录你的域名服务商（阿里云、腾讯云、Namecheap 等），添加一条 **A 记录**：

```text
主机记录: @
记录类型: A
记录值:   你服务器的公网 IP
```

（如果还想用 `www` 访问，再加一条主机记录为 `www` 的 A 记录。）

一般 5 分钟到 2 小时内生效。可以用 https://dnschecker.org 或手机浏览器访问确认。

### 2. 连接服务器

Windows 上推荐用 **Termius**、**Xshell** 或 Windows 自带的终端连接服务器：

```bash
ssh root@你的服务器IP
```

### 3. 一键部署

SSH 登录服务器后，把下面的命令粘贴进去执行（会自动安装 Docker、拉取代码、配置环境、启动服务、配置 Nginx 和 HTTPS）：

```bash
cd /opt && curl -fsSL https://raw.githubusercontent.com/yang-san-lab/Goal-Tracker/main/deploy.sh -o deploy.sh && sudo bash deploy.sh
```

过程中只需要回答两个问题：

1. **你的域名**（例如 `example.com`，不要带 `http://`）
2. **DeepSeek API Key**（`sk-` 开头）

部署完成后访问：

```text
https://你的域名
```

### 手动部署（可选，不推荐新手）

如果你不想用一键脚本，也可以按下面的步骤手动操作。

#### 安装 Docker

```bash
curl -fsSL https://get.docker.com | sh
```

#### 拉取代码

```bash
git clone https://github.com/yang-san-lab/Goal-Tracker.git /opt/goal-tracker
cd /opt/goal-tracker
```

#### 配置环境变量

```bash
mkdir -p data
cp backend/.env.example backend/.env
```

编辑 `backend/.env`，至少修改两项：

```bash
SECRET_KEY=换成随机长字符串
DEEPSEEK_API_KEY=sk-你的密钥
```

#### 启动服务

```bash
docker compose up -d --build
```

容器内的前端 Nginx 监听 `127.0.0.1:8080`，后端 FastAPI 监听 `127.0.0.1:8000`，都只对服务器本机开放。

检查是否正常：

```bash
curl http://127.0.0.1:8080/api/health
```

#### 配置域名反向代理

安装 Nginx：

```bash
apt install nginx -y
```

创建站点配置 `/etc/nginx/sites-available/goaltracker`：

```nginx
server {
    listen 80;
    server_name 你的域名.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

启用配置并重启 Nginx：

```bash
ln -sf /etc/nginx/sites-available/goaltracker /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

#### 申请 HTTPS 证书

```bash
apt install certbot python3-certbot-nginx -y
certbot --nginx -d 你的域名.com
```

按提示选择自动跳转到 HTTPS 即可。

### 更新部署

代码有更新时，在服务器 `/opt/goal-tracker` 目录执行：

```bash
git pull
docker compose up -d --build
```

### 常用运维命令

```bash
docker compose logs -f         # 查看日志
docker compose restart         # 重启服务
docker compose down            # 停止服务
docker compose ps              # 查看容器状态
```

数据存在 `/opt/goal-tracker/data`（SQLite 数据库），重装容器不会丢失。

---

## 📁 项目结构

```text
demo4/
├── backend/                       # Python FastAPI 后端
│   ├── app/
│   │   ├── main.py               # 应用入口
│   │   ├── config.py             # 环境变量配置
│   │   ├── database.py           # SQLite / PostgreSQL
│   │   ├── models/               # 数据模型（多张表）
│   │   ├── schemas/              # API 请求/响应模型
│   │   ├── routers/              # API 路由
│   │   │   ├── auth.py           # 注册 / 登录 / JWT
│   │   │   ├── goals.py          # 目标 + AI 拆解/调整
│   │   │   └── tasks.py          # 每日任务 + 打卡
│   │   ├── services/             # 业务逻辑
│   │   │   ├── ai_service.py     # DeepSeek API 封装
│   │   │   ├── goal_service.py   # 目标编排
│   │   │   ├── task_service.py   # 任务 & 打卡
│   │   │   └── rule_engine.py    # 规则引擎
│   │   ├── events/               # 事件总线（扩展预留）
│   │   └── prompts/              # AI Prompt 模板
│   ├── Dockerfile
│   ├── requirements.txt
│   └── .env.example
├── frontend/                      # React + TypeScript + Vite
│   ├── src/
│   │   ├── api/                  # API 客户端
│   │   ├── components/           # 组件（TaskCard / ProgressBar 等）
│   │   ├── pages/                # 页面
│   │   ├── hooks/                # useAuth / useTasks
│   │   └── types/                # TypeScript 类型定义
│   ├── Dockerfile
│   ├── nginx.conf
│   └── public/manifest.json      # PWA 配置
├── docker-compose.yml             # 一键部署
└── README.md
```

---

## 🔌 API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 注册 |
| POST | `/api/auth/login` | 登录 |
| GET | `/api/auth/me` | 当前用户信息 |
| POST | `/api/goals/` | 创建目标（触发 AI 拆解） |
| GET | `/api/goals/` | 目标列表 |
| GET | `/api/goals/{id}` | 目标详情（含 AI 拆解结果） |
| GET | `/api/goals/{id}/progress` | 目标完成进度 |
| POST | `/api/goals/adjust` | 触发 AI 动态调整 |
| GET | `/api/tasks/daily?target_date=YYYY-MM-DD` | 每日任务 |
| POST | `/api/tasks/checkin` | 打卡（完成/延期/跳过） |
| GET | `/api/tasks/week?week_start=YYYY-MM-DD` | 周进度 |
| GET | `/api/tasks/overdue` | 逾期任务列表 |
| GET | `/api/health` | 健康检查 |

---

## 📱 PWA 移动端支持

手机浏览器打开后，添加到主屏幕即可像原生 App 一样使用：

- **iOS Safari**：分享 → 添加到主屏幕
- **Android Chrome**：菜单 → 添加到主屏幕

---

## 🔧 后续扩展

| 功能 | 改动量 | 说明 |
|------|--------|------|
| **积分/成就系统** | 小 | 数据库表已建好，事件总线已就绪，注册新监听器即可 |
| **统计分析图表** | 中 | 前端组件目录已预留，接入 Recharts 即可 |
| **PWA 推送通知** | 中 | Service Worker 注册点已预留 |
| **PostgreSQL** | 小 | 改一行 `DATABASE_URL` 配置 |
| **微信小程序** | 大 | 后端 API 可直接复用，前端需重写 |
| **多人协作目标** | 大 | 新增团队模型和权限系统 |

---

## ⚠️ 注意事项

- **API Key 安全**：`.env` 不要提交到 Git，生产环境密钥放服务器环境变量
- **SQLite**：适合个人/小团队使用，高并发时切 PostgreSQL
- **DeepSeek 费用**：约 1/百万元 token，一次目标拆解约消耗 3000-8000 token，成本约 0.003-0.008 元
