# Auto-Update Feature

Email Loop Agent 现在支持自动更新功能。当 GitHub 仓库有新版本时，agent 会自动拉取代码并重启服务。

## 工作原理

1. **定期检查**: Agent 每 5 分钟检查一次 GitHub 仓库是否有更新
2. **自动拉取**: 发现新版本时，自动执行 `git pull`
3. **保护配置**: 自动备份和恢复 `.env` 配置文件
4. **安装依赖**: 自动运行 `bun install` 更新依赖
5. **重启服务**: 通过 systemd 自动重启服务

## 配置选项

在 `.env` 文件中添加以下配置：

```bash
# 检查更新的间隔时间（毫秒），默认 5 分钟
UPDATE_CHECK_INTERVAL=300000

# 是否启用自动更新，默认启用
AUTO_UPDATE=true
```

## 手动更新

如果你想手动触发更新，可以运行：

```bash
cd ~/email-loop-agent
./auto-update.sh
```

## 查看更新日志

更新日志保存在 `auto-update.log` 文件中：

```bash
tail -f ~/email-loop-agent/auto-update.log
```

## 禁用自动更新

如果你想禁用自动更新，在 `.env` 中设置：

```bash
AUTO_UPDATE=false
```

这样 agent 仍会检查更新并提示，但不会自动执行更新。

## Systemd 服务配置

自动更新需要 systemd 服务有重启权限。安装脚本已经自动配置了以下内容：

```ini
[Service]
Restart=always
RestartSec=10
```

这确保了更新后服务会自动重启。

## 安全性

- `.env` 配置文件会被自动备份和恢复，不会丢失
- 更新失败时会自动回滚配置
- 使用 `git pull` 而不是 `git reset --hard`，保护本地修改
- 更新日志会自动清理，只保留最近 100 行

## 故障排除

### 更新失败

如果自动更新失败，检查：

1. Git 仓库状态：`git status`
2. 网络连接：`ping github.com`
3. 更新日志：`cat auto-update.log`

### 服务无法重启

如果服务重启失败：

```bash
# 检查服务状态
sudo systemctl status email-loop-agent

# 查看日志
sudo journalctl -u email-loop-agent -n 50

# 手动重启
sudo systemctl restart email-loop-agent
```

### 禁用自动更新

如果遇到问题，可以临时禁用：

```bash
# 编辑 .env
echo "AUTO_UPDATE=false" >> .env

# 重启服务
sudo systemctl restart email-loop-agent
```

## 更新通知

Agent 会在日志中输出更新信息：

```
[UpdateChecker] Checking for updates...
[UpdateChecker] Local:  abc1234
[UpdateChecker] Remote: def5678
[UpdateChecker] ✨ New version available!
[UpdateChecker] Starting auto-update...
[UpdateChecker] Update completed successfully
```

可以通过 journalctl 查看：

```bash
sudo journalctl -u email-loop-agent -f | grep UpdateChecker
```
