
# DDN Scripts

DDN开发脚本工具，用于管理 examples 目录下的多节点开发环境。该工具实现了原始 shell 脚本的所有功能，并进行了多项改进。


## 功能

相比于原始的 shell 脚本，该工具有以下改进：

1. **密钥分发**：自动将受托人密钥分发到不同节点
2. **P2P 端口配置**：正确处理 HTTP 端口和 P2P 端口
3. **模板目录复制**：从模板目录复制完整的配置和文件
4. **健康检查**：检查节点是否成功启动，如果启动失败会尝试终止进程
5. **多项目支持**：支持 fun-tests 和 main-tests 两种项目类型
6. **命令行界面**：提供更友好的命令行界面和帮助信息

## 安装

### 方法一：使用安装脚本

```bash
cd scripts/ddn-scripts
chmod +x install.sh
./install.sh
```

或者

```bash
cd scripts/ddn-scripts
npm run install-local
```

### 方法二：手动安装

```bash
cd scripts/ddn-scripts
npm install
npm run build
npm link
```

如果遇到模块加载错误，请尝试以下命令：

```bash
cd scripts/ddn-scripts
npm install --save @oclif/core @oclif/plugin-help oclif
npm run build
npm link
```

## 测试

运行单元测试：

```bash
npm test
```

运行测试并监视文件变化：

```bash
npm run test:watch
```

生成测试覆盖率报告：

```bash
npm run test:coverage
```

## 配置说明

### 项目类型

所有命令都支持 `-t` 参数指定项目类型：

- `fun-tests`：娱乐测试网络（默认）
- `main-tests`：主网测试网络

### 端口说明

工具使用两组端口：

- HTTP 端口：从 8001 开始，用于 HTTP API 通信
- P2P 端口：从 9001 开始，用于节点间 P2P 通信

每个节点都有一个 HTTP 端口和一个 P2P 端口。例如，第一个节点的 HTTP 端口是 8001，P2P 端口是 9001。


## 目录结构

```
examples/
├── fun-tests/
│   ├── config/
│   │   └── ...
│   └── app.js
├── main-tests/
│   ├── config/
│   │   └── ...
│   └── app.js
├── peer-8001/
│   ├── logs/
│   ├── db/
│   ├── public/
│   ├── ssl/
│   └── .ddnrc.js
├── peer-8002/
│   └── ...
└── ...

### 启动多个节点

```bash
# 启动5个节点（默认）
ddn-scripts peers:start

# 启动3个节点
ddn-scripts peers:start -n 3

# 强制启动（即使端口已被占用）
ddn-scripts peers:start -f

# 启动单个特定节点
ddn-scripts peers:start -p 8001

# 在主网测试项目中启动节点
ddn-scripts peers:start -t main-tests
```

### 停止节点

```bash
# 停止所有节点
ddn-scripts peers:stop

# 停止3个节点
ddn-scripts peers:stop -n 3

# 强制停止（使用SIGKILL）
ddn-scripts peers:stop -f

# 停止单个特定节点
ddn-scripts peers:stop -p 8001

# 停止主网测试项目中的节点
ddn-scripts peers:stop -t main-tests
```

### 清理节点数据

```bash
# 清理所有节点的所有数据
ddn-scripts peers:clean

# 只清理数据库
ddn-scripts peers:clean -c db

# 只清理日志
ddn-scripts peers:clean -c log

# 清理特定文件
ddn-scripts peers:clean -f blockchain

# 清理特定节点
ddn-scripts peers:clean -p 8001

# 清理主网测试项目中的节点数据
ddn-scripts peers:clean -t main-tests
```

### 监控节点

```bash
# 监控所有节点
ddn-scripts peers:monitor

# 设置监控间隔（秒）
ddn-scripts peers:monitor -i 30

# 启用自动重启
ddn-scripts peers:monitor -r

# 监控主网测试项目中的节点
ddn-scripts peers:monitor -t main-tests
```


## 节点查看

为了验证上述信息，可以查看节点的日志文件，或者使用 ddn 查看节点状态。

```sh
# 查看节点日志
$ tail -f ./logs/main.log
$ tail -f ./logs/debug.log
$ tail -f ./logs/dvm.log

# 查看节点状态
$ ddn d peerStat -H 127.0.0.1 -P 8001
$ ddn d peerStat -H 117.78.45.44 -P 8000 -M
```

查看浏览器 http://127.0.0.1:8001/api/blocks/getHeight


## 开发

```bash
# 构建
npm run build

# 运行测试
npm test
```

## FAQ

1. 如果出现 `Error: listen EADDRINUSE: address already in use :::8001` 错误，说明端口已经被占用，需要修改端口号。
2. 如果出现 Sandbox is not ready 错误，最可能是数据库初始化中出现问题，拷贝一个 blockchain.db 过来即可。


## 许可证

MIT

