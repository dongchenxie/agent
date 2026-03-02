# Agent 重构测试计划

## 测试策略

为了保证重构前后功能完全一致，我们需要建立完整的测试套件。

## 测试层级

### 1. 单元测试 (Unit Tests)
测试每个模块的独立功能

#### constants.ts
- ✅ `getXMailerForEmail()` 对相同邮箱返回相同的客户端
- ✅ `getXMailerForEmail()` 对不同邮箱返回不同的客户端
- ✅ EMAIL_CLIENTS 数组包含 100+ 个客户端

#### utils.ts
- ✅ `sleep()` 正确延迟指定时间
- ✅ `randomDelay()` 在指定范围内延迟
- ✅ `timestamp()` 返回 ISO 格式时间戳

#### task-queue.ts
- ✅ `addTasks()` 正确添加任务到队列
- ✅ `shiftTask()` 正确移除并返回第一个任务
- ✅ `removeTaskByIndex()` 正确移除指定索引的任务
- ✅ `getQueueSize()` 返回正确的队列大小
- ✅ `clearQueue()` 清空所有任务
- ✅ `getMemoryStats()` 返回内存统计信息

#### config.ts
- ✅ `updateConfig()` 正确更新配置
- ✅ `setAgentToken()` 和 `getAgentToken()` 正确管理令牌

#### oauth.ts
- ✅ `getOAuth2AccessToken()` 成功获取令牌
- ✅ `getOAuth2AccessToken()` 处理失败情况

#### api-client.ts
- ✅ `register()` 成功注册
- ✅ `register()` 处理注册失败
- ✅ `poll()` 成功轮询任务
- ✅ `poll()` 处理轮询失败
- ✅ `report()` 成功报告结果
- ✅ `report()` 重试机制正常工作
- ✅ `reportImap()` 成功报告 IMAP 结果
- ✅ `sendHealthCheck()` 发送心跳

### 2. 集成测试 (Integration Tests)
测试模块之间的交互

#### Agent 生命周期
- ✅ Agent 启动 → 注册 → 轮询 → 处理任务 → 报告结果
- ✅ Agent 处理多个任务
- ✅ Agent 优雅关闭

#### 任务处理流程
- ✅ 接收任务 → 添加到队列 → 发送邮件 → 报告结果 → 从队列移除
- ✅ 任务失败时的重试逻辑
- ✅ 任务失败后正确从队列移除（防止内存泄漏）

#### IMAP 检查流程
- ✅ 轮询 IMAP 任务 → 检查邮箱 → 报告结果
- ✅ IMAP 连接失败时的处理
- ✅ IMAP 事件监听器正确清理（防止内存泄漏）

### 3. 端到端测试 (E2E Tests)
测试完整的 Agent 行为

#### 场景 1: 正常工作流程
```
1. 启动 Agent
2. 注册到主服务器
3. 轮询获取 5 个任务
4. 发送 5 封邮件
5. 报告结果
6. 验证队列为空
7. 优雅关闭
```

#### 场景 2: 错误处理
```
1. 启动 Agent
2. 注册失败 → 重试 → 成功
3. 轮询获取任务
4. 发送邮件失败 → 重试 → 成功
5. 报告结果失败 → 重试 → 成功
6. 验证所有任务都被处理
```

#### 场景 3: 内存泄漏测试
```
1. 启动 Agent
2. 循环 1000 次：
   - 轮询任务
   - 处理任务
   - 报告结果
3. 记录内存使用
4. 验证内存没有持续增长
5. 验证队列大小保持稳定
```

### 4. 快照测试 (Snapshot Tests)
保存重构前的行为作为基准

#### 日志输出快照
- ✅ 记录 Agent 启动时的日志输出
- ✅ 记录任务处理时的日志输出
- ✅ 记录错误处理时的日志输出

#### API 调用快照
- ✅ 记录注册请求的格式
- ✅ 记录轮询请求的格式
- ✅ 记录报告请求的格式

## 测试工具

### Jest
- 单元测试框架
- 快照测试
- 覆盖率报告

### Nock
- HTTP 请求 mock
- 模拟主服务器响应

### Sinon
- 函数 mock 和 spy
- 时间控制

## 测试执行步骤

### 阶段 1: 为原始代码创建测试（基准）

```bash
# 1. 安装测试依赖
cd agent
npm install --save-dev jest @types/jest ts-jest nock sinon @types/sinon

# 2. 配置 Jest
# 创建 jest.config.js

# 3. 创建测试文件
# __tests__/original/agent.test.ts - 测试原始 index.ts

# 4. 运行测试，确保全部通过
npm test

# 5. 生成覆盖率报告
npm run test:coverage

# 6. 保存测试结果作为基准
npm test -- --json --outputFile=test-results-original.json
```

### 阶段 2: 完成重构

```bash
# 1. 创建剩余模块
# - email-sender.ts
# - imap-checker.ts

# 2. 重构 index.ts
# - 导入所有模块
# - 移除已拆分的代码
# - 保留主循环逻辑

# 3. 修复 IMAP 内存泄漏
# - 将 .on() 改为 .once()
# - 或添加 .removeAllListeners()
```

### 阶段 3: 运行测试验证

```bash
# 1. 运行所有测试
npm test

# 2. 对比测试结果
npm test -- --json --outputFile=test-results-refactored.json
diff test-results-original.json test-results-refactored.json

# 3. 验证覆盖率没有下降
npm run test:coverage

# 4. 运行内存泄漏测试
npm run test:memory-leak
```

### 阶段 4: 手动验证

```bash
# 1. 启动 Agent
npm start

# 2. 监控内存使用
watch -n 5 'ps aux | grep agent'

# 3. 运行 24 小时
# 验证内存保持稳定

# 4. 检查日志
tail -f logs/*.log
```

## 测试覆盖率目标

- **单元测试覆盖率**: ≥ 80%
- **集成测试覆盖率**: ≥ 60%
- **关键路径覆盖率**: 100%
  - 任务接收和处理
  - 邮件发送
  - 结果报告
  - 错误处理
  - 队列管理

## 成功标准

重构成功的标准：

1. ✅ 所有测试通过（原始测试和新测试）
2. ✅ 测试覆盖率不低于重构前
3. ✅ 快照测试通过（行为一致）
4. ✅ 内存泄漏测试通过（内存稳定）
5. ✅ 手动测试通过（24小时运行稳定）
6. ✅ 代码审查通过
7. ✅ 性能测试通过（不慢于重构前）

## 回滚计划

如果测试失败：

1. 保留原始 `index.ts` 为 `index.ts.backup`
2. 如果重构失败，可以快速回滚
3. 分析失败原因
4. 修复问题
5. 重新运行测试

## 下一步

1. **立即执行**: 创建测试文件
2. **然后**: 为原始代码编写测试
3. **接着**: 完成重构
4. **最后**: 验证所有测试通过

## 测试文件结构

```
agent/
├── __tests__/
│   ├── unit/
│   │   ├── constants.test.ts
│   │   ├── utils.test.ts
│   │   ├── task-queue.test.ts
│   │   ├── config.test.ts
│   │   ├── oauth.test.ts
│   │   └── api-client.test.ts
│   ├── integration/
│   │   ├── agent-lifecycle.test.ts
│   │   ├── task-processing.test.ts
│   │   └── imap-checking.test.ts
│   ├── e2e/
│   │   ├── normal-workflow.test.ts
│   │   ├── error-handling.test.ts
│   │   └── memory-leak.test.ts
│   └── snapshots/
│       ├── logs.snap
│       └── api-calls.snap
├── jest.config.js
└── test-package.json
```
