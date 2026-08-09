# 🎯 Goal Tracker — AI 驱动的目标拆解与动态调整系统

把你的大目标交给 AI，自动拆解成每月、每周、每日的可执行任务。每天打卡反馈，AI 会根据你的实际执行情况动态调整后续计划。

**AI 引擎：DeepSeek API**（成本极低，约 ¥1/百万 token）

---

## 🚀 本地开发启动

### 你需要先做这些（约 15 分钟）

#### 1. 安装环境

- **Python 3.11+**：[下载](https://www.python.org/downloads/)
- **Node.js 20+**：[下载](https://nodejs.org/)

```bash
python --version
node --version
```

#### 2. 获取 DeepSeek API Key

1. 打开 [https://platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys)
2. 注册账号（送免费额度，之后按量付费极便宜）
3. 创建 API Key，复制 `sk-...` 开头的 Key

#### 3. 配置环境变量

```bash
cd backend
cp .env.example .env
```

编辑 `.env`，填入你的 DeepSeek API Key：
```
DEEPSEEK_API_KEY=sk-你的密钥
```

---

### 启动后端

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux

pip install -r requirements.txt
uvicorn app.main:app --reload
```

后端运行在 http://localhost:8000

### 启动前端

```bash
cd frontend
npm install
npm run dev
```

前端运行在 http://localhost:5173

手机访问：确保同一 WiFi，访问 `http://<电脑IP>:5173`

---

## 📦 服务器部署（Docker）

### 1. 上传代码到服务器

```bash
# 在服务器上
git clone <你的仓库地址> goal-tracker
cd goal-tracker
```

### 2. 配置环境变量

```bash
# 在服务器上创建 .env
cat > backend/.env << 'EOF'
DATABASE_URL=sqlite:///./data/goal_tracker.db
SECRET_KEY=换成随机长字符串
DEEPSEEK_API_KEY=sk-你的密钥
DEEPSEEK_BASE_URL=https://api.deepseek.com
AI_MODEL=deepseek-chat
EOF
```

### 3. 启动

```bash
# 安装 Docker（如果还没有）
curl -fsSL https://get.docker.com | sh

# 启动
docker compose up -d --build
```

服务运行在 `http://<你的服务器IP>:80`

### 4. 配置域名 + HTTPS（推荐）

使用 Nginx 反向代理 + Let's Encrypt 免费证书：

```bash
# 安装 certbot
apt install certbot python3-certbot-nginx -y

# 配置 Nginx（示例 /etc/nginx/sites-available/goaltracker）
cat > /etc/nginx/sites-available/goaltracker << 'EOF'
server {
    listen 80;
    server_name 你的域名.com;

    location / {
        proxy_pass http://127.0.0.1:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

ln -s /etc/nginx/sites-available/goaltracker /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# 申请 SSL 证书
certbot --nginx -d 你的域名.com
```

---

## 🧩 项目结构

```
demo4/
├── backend/                       # Python FastAPI 后端
│   ├── app/
│   │   ├── main.py               # 应用入口
│   │   ├── config.py             # 环境变量配置
│   │   ├── database.py           # SQLite / PostgreSQL
│   │   ├── models/               # 数据模型（9张表）
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
│   │   ├── components/           # 组件（TaskCard / ProgressBar）
│   │   ├── pages/                # 页面（6个）
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
- **DeepSeek 费用**：约 ¥1/百万 token，一次目标拆解约消耗 3000-8000 token，成本 ¥0.003-0.008
