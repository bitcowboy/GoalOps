# GoalOps 部署手册

把 GoalOps（前端 + PocketBase + MCP）部署到一台 Linux VPS，对外通过 Caddy
暴露 `https://goal.996007.fun`。

## 架构一图流

```
              https://goal.996007.fun
                       │
                  ┌────┴────┐
                  │  Caddy  │ 443 (自动 Let's Encrypt)
                  └─┬───┬─┬─┘
                    │   │ │
            /  /api │   │ │ /mcp (basic_auth)
           /_/ (auth)│  │ │
                    ▼   ▼ ▼
                127.0.0.1
                :8090   :8765
              PocketBase  MCP (Node, HTTP)
                  │         │
                  ▼         │
              pb_data/ ◄────┘
```

| 路径 | 后端 | 鉴权 |
|---|---|---|
| `/` | 静态 `dist/` | 无 |
| `/api/*` | PB :8090 | 集合规则（当前 open guest） |
| `/_/*` | PB Admin UI :8090 | Caddy basic_auth |
| `/mcp` | MCP :8765 | Caddy basic_auth |

---

## 一次性服务器初始化

> 假设：Ubuntu 22.04 / Debian 12，有 sudo 的非 root 账号，已装 Caddy。

### 1. 装 Node 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version   # v20.x
```

### 2. 创建专用服务账号 + 目录

```bash
sudo useradd --system --create-home --shell /usr/sbin/nologin goalops
sudo mkdir -p /opt/goalops/{pocketbase,mcp,backups} /var/www/goalops /etc/goalops
sudo chown -R goalops:goalops /opt/goalops /var/www/goalops
```

### 3. 下载 PocketBase Linux 二进制

> 选与你本地 `pocketbase.exe --version` 一致的版本。

```bash
cd /tmp
PB_VER=0.22.21   # 改成你需要的版本
curl -LO "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VER}/pocketbase_${PB_VER}_linux_amd64.zip"
unzip "pocketbase_${PB_VER}_linux_amd64.zip"
sudo install -o goalops -g goalops -m 0755 pocketbase /opt/goalops/pocketbase/pocketbase
/opt/goalops/pocketbase/pocketbase --version
```

### 4. 复制 systemd unit + 环境文件

仓库里 `deploy/systemd/` 已经准备好。从你的开发机执行：

```bash
# 把 unit 文件传上去
scp deploy/systemd/pocketbase.service     goalops-host:/tmp/
scp deploy/systemd/goalops-mcp.service    goalops-host:/tmp/
scp deploy/systemd/mcp.env.example        goalops-host:/tmp/
```

服务器上：

```bash
sudo mv /tmp/pocketbase.service /tmp/goalops-mcp.service /etc/systemd/system/
sudo mv /tmp/mcp.env.example /etc/goalops/mcp.env
sudo chown root:goalops /etc/goalops/mcp.env
sudo chmod 640 /etc/goalops/mcp.env
sudo $EDITOR /etc/goalops/mcp.env   # 改 superuser 邮箱密码（可选）
sudo systemctl daemon-reload
```

### 5. 配置 Caddy

把 `deploy/Caddyfile` 内容追加到 `/etc/caddy/Caddyfile`（或 `import` 它）。
然后生成两条 basicauth 密码哈希：

```bash
# 给 PB Admin UI 用
caddy hash-password
# 给 MCP 用（团队成员客户端要填这个密码）
caddy hash-password
```

> **必须在这台服务器上用它自己的 caddy 跑** `hash-password`。Caddy 不同版本输出
> 格式不同：
> - v2.6 及以下输出 base64 字符串（无 `$2a$` 前缀），对应版本的 `basicauth`
>   也只认这种格式。
> - v2.7+ 输出 `$2a$14$...` bcrypt 字符串。
>
> 直接把当前服务器 `caddy hash-password` 输出的整串原样粘进 Caddyfile 就是对
> 的，无需手动转换。

把得到的整串分别填到 Caddyfile 里两处 `BCRYPT_HASH_*` 占位。

```bash
sudo caddy validate --config /etc/caddy/Caddyfile   # 先验证再 reload
sudo systemctl reload caddy
```

首次访问 `https://goal.996007.fun` 时 Caddy 会自动签证书；DNS 必须先指过来。

> Caddy 版本相关注意：
> - 仓库里的 Caddyfile 用 `basicauth`（无下划线）以兼容 Caddy < v2.8。
>   v2.8+ 接受 `basic_auth` 别名，但 `basicauth` 仍可用，只会有
>   deprecation 警告。
> - 80 端口必须对外开放，否则 Let's Encrypt ACME HTTP-01 挑战会失败。

---

## 首次部署

从开发机执行。**Windows 11 / PowerShell 用 `.ps1`；Linux/macOS/WSL 用 `.sh`**，
两个脚本等价，二选一：

```powershell
# Windows 11 (PowerShell 5.1+，无需装 WSL / rsync / Git Bash)
.\deploy\deploy.ps1
```

```bash
# Linux / macOS / WSL
./deploy/deploy.sh
```

Windows 版用系统自带的 `ssh.exe` / `scp.exe` / `tar.exe`（System32 下，Win10/11
默认装好）。Linux 版用 `rsync`，传输是增量的；Windows 版每次打 tar 包整传，
对 GoalOps 这种小体量项目（dist ~几 MB，mcp 源码 ~几十 KB）速度差异忽略不计。

脚本会：
1. `npm run build` 生成 `dist/`
2. 把 `dist/` 推到 `/var/www/goalops/`（Windows 版走 tar+scp+原子 mv，Linux 版走 rsync）
3. 把 `mcp/` 源码 + `pb_migrations/` + `pb_hooks/` 上服务器
4. 服务器上 `npm ci && npm run build`
5. `pocketbase migrate up` 应用迁移
6. `systemctl restart` PB 和 MCP

> `pb_hooks/` 同步是 v1.0 起新增的（KR check-in / KR 类型校验 / derived endpoint
> 全靠它）。若服务器上原本没这个目录，脚本会自动创建。

完成后：

```bash
# 服务器上
sudo systemctl enable pocketbase.service goalops-mcp.service
sudo systemctl status pocketbase.service goalops-mcp.service
curl -I http://127.0.0.1:8090/api/health   # PB
curl -I http://127.0.0.1:8765/healthz      # MCP
```

浏览器打开 `https://goal.996007.fun/`，应该能看到首页。打开
`https://goal.996007.fun/_/`，basic_auth 弹窗里填 PB Admin 那一对，再用 PB
superuser 登录后台。

> 没创建过 PB superuser？服务器上执行：
> ```bash
> sudo -u goalops /opt/goalops/pocketbase/pocketbase superuser create you@example.com 'a-strong-pw'
> ```

---

## 团队成员的 MCP 客户端配置

每个团队成员都拿同一对 basic_auth 凭据（用户名 `goalops`，密码就是你刚才
`caddy hash-password` 时输入的那个）。

### Claude Code

```bash
claude mcp add --transport http goalops \
  --header "Authorization: Basic $(printf 'goalops:THE_PASSWORD' | base64)" \
  https://goal.996007.fun/mcp
```

### Claude Desktop

`claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "goalops": {
      "type": "http",
      "url": "https://goal.996007.fun/mcp",
      "headers": {
        "Authorization": "Basic Z29hbG9wczpUSEVfUEFTU1dPUkQ="
      }
    }
  }
}
```

> 那串 base64 是 `goalops:THE_PASSWORD` 用 `printf ... | base64` 得到。
> 不要把它发到公开渠道。

测试：

```bash
curl -u goalops:THE_PASSWORD https://goal.996007.fun/mcp \
  -X POST -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

应该返回 `goalops_objectives_list` 等工具列表。

### 排障：Claude Code 报 ConnectionRefused 但 curl 能通

通常是**本地代理 / IPv6** 把 Node 的请求拦了，PowerShell `Invoke-WebRequest`
走系统 PAC 没事，但 Claude Code 内嵌的 Node fetch 走自己的规则。先在出问题
的机器上跑：

```powershell
Resolve-DnsName goal.996007.fun
Test-NetConnection -ComputerName goal.996007.fun -Port 443
```

- 若解析出 AAAA 记录 + `RemoteAddress` 是 IPv6 + `TcpTestSucceeded: False`
  → IPv6 不通。临时绕开：`$env:NODE_OPTIONS = '--dns-result-order=ipv4first'`，
  再 `claude mcp list`。永久修法是把 DNS 的 AAAA 记录去掉，或在服务器上把
  IPv6 监听 / 路由配通。
- 若本机挂了 Clash / V2Ray 等代理，但规则没把 `goal.996007.fun` 直连或正确
  代理 → 在代理规则里加白名单 / 直连规则后重试。`HTTP_PROXY` / `HTTPS_PROXY`
  环境变量通常不影响（这些是给 Node 默认 fetch 用的，但代理客户端通常拦
  TCP 层），但同样建议确认 `$env:HTTPS_PROXY` 没被设错。

---

## 滚动更新

代码改完，开发机上：

**Windows / PowerShell：**

```powershell
.\deploy\deploy.ps1                    # 整套更新
.\deploy\deploy.ps1 -SkipMigrate       # 只改代码、没动 schema
.\deploy\deploy.ps1 -SkipMcp           # 只改前端
.\deploy\deploy.ps1 -SkipFrontend      # 只改 MCP
```

**Linux / macOS / WSL：**

```bash
./deploy/deploy.sh                  # 整套更新
SKIP_MIGRATE=1 ./deploy/deploy.sh   # 只改代码、没动 schema
SKIP_MCP=1 ./deploy/deploy.sh       # 只改前端
SKIP_FRONTEND=1 ./deploy/deploy.sh  # 只改 MCP
```

---

## 备份

把 `deploy/backup.sh` 放到 `/opt/goalops/scripts/` 并加 cron：

```bash
sudo install -o goalops -g goalops -m 0755 \
  deploy/backup.sh /opt/goalops/scripts/backup.sh

sudo crontab -u goalops -e
# 加一行：
15 3 * * * /opt/goalops/scripts/backup.sh >> /opt/goalops/backups/backup.log 2>&1
```

恢复：停 PB → 解压覆盖 `pb_data/` → 启 PB。

```bash
sudo systemctl stop pocketbase
sudo -u goalops tar xzf /opt/goalops/backups/pb_data-YYYYMMDDT....tar.gz \
  -C /opt/goalops/pocketbase/
sudo systemctl start pocketbase
```

---

## 日常排障

| 现象 | 排查 |
|---|---|
| 浏览器 502 | `sudo systemctl status pocketbase` / `journalctl -u pocketbase -n 50` |
| `/mcp` 401 | basic_auth 哈希没填或客户端 header 错 |
| `/mcp` 502 | `journalctl -u goalops-mcp -n 50`，检查 PB 是否在跑 |
| 前端能开但数据空 | 浏览器 devtools 看 `/api/*` 是否走通；Caddy 日志在 `/var/log/caddy/` |
| Realtime 不推 | Caddyfile 的 `flush_interval -1` 是否保留；PB realtime 端点是 `/api/realtime` |
| 证书签发失败 | DNS 是否指到服务器；80 端口是否对外开放（Caddy ACME 需要 80） |

---

## 下一步（暂未做，等以后再加）

- PB users 集合的真鉴权，前端加登录页，去掉 open guest rules
- MCP 改成 OAuth / per-user token 而不是共享 basic_auth
- 加监控（Caddy `/metrics` + Prometheus，或最简单的 cron 健康检查）
- pb_data 异地备份（`REMOTE_SCP_TARGET` 配到对象存储或另一台机器）
