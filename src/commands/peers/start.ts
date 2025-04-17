import { Flags } from '@oclif/core'
import * as fs from 'fs'
import * as path from 'path'
import { BaseCommand } from '../../base-command'

export default class PeersStart extends BaseCommand {
  static description = '启动多个DDN节点'

  static examples = [
    '$ ddn-scripts peers:start',
    '$ ddn-scripts peers:start -n 3',
    '$ ddn-scripts peers:start -n 3 -f',
    '$ ddn-scripts peers:start -p 8001',
    '$ ddn-scripts peers:start -t main-tests',
  ]

  static flags = {
    count: Flags.integer({
      char: 'n',
      description: '要启动的节点数量',
      default: BaseCommand.defaultPeerCount,
    }),
    force: Flags.boolean({
      char: 'f',
      description: '强制启动，即使节点已经在运行',
      default: false,
    }),
    port: Flags.integer({
      char: 'p',
      description: '指定要启动的单个节点端口',
    }),
    genesis: Flags.boolean({
      char: 'g',
      description: '是否使用创世块配置',
      default: false,
    }),
    project: BaseCommand.baseFlags.project,
    help: Flags.help({ char: 'h' }),
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(PeersStart)
    const peerCount = flags.count
    const basePort = BaseCommand.basePort
    const force = flags.force
    const specificPort = flags.port
    const useGenesis = flags.genesis
    const projectType = flags.project

    // 保存实际的节点数量，用于后续配置
    this.actualPeerCount = peerCount

    // 检查项目目录是否存在
    const projectDir = this.getTestProjectDir(projectType)
    if (!fs.existsSync(projectDir)) {
      this.log(`项目目录 ${projectDir} 不存在，正在创建...`)
      fs.mkdirSync(projectDir, { recursive: true })
    }

    // 检查 examples 目录是否存在
    const examplesDir = this.getExamplesDir()
    if (!fs.existsSync(examplesDir)) {
      this.log(`examples 目录 ${examplesDir} 不存在，正在创建...`)
      fs.mkdirSync(examplesDir, { recursive: true })
    }

    this.log(`使用项目: ${projectType}`)

    if (specificPort) {
      await this.startSinglePeer(specificPort, force, useGenesis, projectType)
    } else {
      this.log(`准备启动 ${peerCount} 个节点...`)
      for (let i = 1; i <= peerCount; i++) {
        const port = basePort + i - 1
        await this.startSinglePeer(port, force, useGenesis, projectType)
      }
      this.log('所有节点启动完成')
    }
  }

  // 存储实际的节点数量
  private actualPeerCount: number = BaseCommand.defaultPeerCount

  private async startSinglePeer(port: number, force: boolean, useGenesis: boolean, projectType: string): Promise<void> {
    // 计算节点索引
    const peerIndex = port - BaseCommand.basePort + 1
    const p2pPort = BaseCommand.p2pBasePort + (port - BaseCommand.basePort)

    // 检查端口是否已被占用
    const isPortInUse = await this.checkPortInUse(port)
    if (isPortInUse && !force) {
      this.log(`端口 ${port} 已被占用，跳过启动。使用 -f 标志强制启动。`)
      return
    }

    if (isPortInUse && force) {
      this.log(`端口 ${port} 已被占用，正在尝试停止现有进程...`)
      await this.executeCommand(`lsof -ti :${port} | xargs kill -9 2>/dev/null || true`)
      await this.sleep(2000) // 等待进程完全停止
    }

    // 获取节点目录路径
    const peerDir = this.getPeerDir(port, projectType)
    const configPath = path.join(peerDir, '.ddnrc.js')

    // 检查目录是否已存在
    const dirExists = fs.existsSync(peerDir)

    // 如果目录不存在，则创建
    if (!dirExists) {
      // 从模板目录复制文件
      this.copyTemplateDir(projectType, peerDir, force)
    } else if (force) {
      // 如果目录已存在且使用了强制选项，则重建
      this.copyTemplateDir(projectType, peerDir, force)
    }

    // 检查配置文件是否存在
    if (!fs.existsSync(configPath)) {
      // 如果配置文件不存在，创建一个新的
      const configContent = this.generateConfig(port, p2pPort, useGenesis, projectType)
      fs.writeFileSync(configPath, configContent)
    }

    // 分发密钥 - 使用实际的节点数量
    // 只有当目录不存在或者使用了强制选项时，才分发密钥、更新端口和对等节点列表
    if (!dirExists || force) {
      this.updateConfig(configPath, port, p2pPort, projectType)
      this.distributeSecrets(configPath, peerIndex, this.actualPeerCount)
    } else {
      this.log(`节点目录 ${peerDir} 已存在，跳过密钥分配、端口更新和对等节点列表更新... (使用 -f 强制重建)`)
    }

    // 启动节点
    this.log(`启动端口为 ${port} 的节点...`)
    // 在节点目录下启动
    const command = `cd ${peerDir} && node --experimental-vm-modules app.js --daemon`

    const { success, output } = await this.executeCommand(command)
    if (success) {
      // 检查节点健康状态
      if (await this.checkPeerHealth(port)) {
        this.log(`节点 ${port} 启动成功`)
      } else {
        this.log(`节点 ${port} 启动失败，健康检查未通过`)
        // 尝试终止进程
        await this.executeCommand(`lsof -ti :${port} | xargs kill -9 2>/dev/null || true`)
      }
    } else {
      this.error(`节点 ${port} 启动失败: ${output}`)
    }
  }

  private generateConfig(port: number, p2pPort: number, useGenesis: boolean, projectType: string): string {
    const peers = []
    // 添加其他节点作为种子节点 - 使用实际的节点数量
    for (let i = 1; i <= this.actualPeerCount; i++) {
      const httpPort = BaseCommand.basePort + i - 1
      const peerP2pPort = BaseCommand.p2pBasePort + i - 1
      if (httpPort !== port) {
        peers.push({
          ip: '127.0.0.1',
          port: peerP2pPort,
          httpPort: httpPort
        })
      }
    }

    // 根据项目类型调整配置
    let additionalConfig = ''
    if (projectType === 'main-tests') {
      additionalConfig = `
  nethash: 'da121d8d8d21a3d6', // 主网测试网络标识
  `
    } else if (projectType === 'fun-tests') {
      additionalConfig = `
  nethash: 'fl3l5l3l5lk3kk3k', // 娱乐测试网络标识
  `
    }

    const genesisConfig = useGenesis ? `
    // 创世块配置
    genesis: {
      delegates: [
        // 添加创世受托人公钥
      ],
      votes: [
        // 添加创世投票
      ],
      assets: [
        // 添加创世资产
      ]
    },` : ''

    return `module.exports = {
  port: ${port},
  peerPort: ${p2pPort},
  address: '127.0.0.1',
  publicIp: '127.0.0.1',
  logLevel: 'debug',${additionalConfig}
  peers: {
    list: ${JSON.stringify(peers, null, 2)},
    blackList: [],
    options: {
      timeout: 4000
    }
  },
  forging: {
    secret: [
      // 添加受托人密钥
    ],
    access: {
      whiteList: [
        '127.0.0.1'
      ]
    }
  },${genesisConfig}
  ssl: {
    enabled: false,
    options: {
      port: ${port + 1000},
      address: '0.0.0.0',
      key: './ssl/server.key',
      cert: './ssl/server.crt'
    }
  }
}`
  }

  private updateConfig(configPath: string, port: number, p2pPort: number, projectType: string): boolean {
    try {
      // 读取配置文件
      let configContent = fs.readFileSync(configPath, 'utf8')

      // 更新端口配置 - 使用更精确的正则表达式
      // 匹配并替换 port 配置
      configContent = configContent.replace(/port:\s*(\d+)/g, (match, oldPort) => {
        // this.log(`匹配到 port: ${oldPort}, 当前节点端口: ${port}, 基础端口: ${BaseCommand.basePort}`)
        // 如果是原始的 HTTP 端口，替换为新的 HTTP 端口
        if (oldPort == BaseCommand.basePort) {
          return `port: ${port}`
        }
        return match
      })

      // 匹配并替换 p2pPort 配置
      configContent = configContent.replace(/p2pPort:\s*(\d+)/g, (match, oldPort) => {
        // this.log(`匹配到 p2pPort: ${oldPort}, 当前节点 P2P 端口: ${p2pPort}, 基础 P2P 端口: ${BaseCommand.p2pBasePort}`)
        // 如果是原始的 P2P 端口，替换为新的 P2P 端口
        if (oldPort == BaseCommand.p2pBasePort) {
          return `p2pPort: ${p2pPort}`
        }
        return match
      })

      // 生成对等节点列表 - 使用实际的节点数量
      let peersList = ''
      let isFirst = true
      for (let i = 1; i <= this.actualPeerCount; i++) {
        const httpPort = BaseCommand.basePort + i - 1
        const peerP2pPort = BaseCommand.p2pBasePort + i - 1
        // 排除当前节点自身
        if (httpPort !== port) {
          // 如果不是第一个节点，添加逗号
          if (!isFirst) {
            peersList += ', '
          }
          // 直接使用与原始文件相同的格式
          peersList += `{ ip: '127.0.0.1', port: '${peerP2pPort}', httpPort: '${httpPort}' }`
          isFirst = false
        }
      }

      // 替换配置文件中的对等节点列表
      const peersRegex = /peers:\s*{[\s\S]*?list:\s*\[[\s\S]*?\][\s\S]*?}/
      const peersReplacement = `peers: {
    list: [
      ${peersList}
    ],
    blackList: [],
    options: {
      timeout: 4000
    }
  `

      configContent = configContent.replace(peersRegex, peersReplacement)

      // 修复端口配置 - 使用更精确的正则表达式
      // 匹配并替换 port 配置
      const portRegex = /^(\s*port:\s*)8001(,?)$/m
      configContent = configContent.replace(portRegex, `$1${port}$2`)

      // 匹配并替换 p2pPort 配置
      const p2pPortRegex = /^(\s*p2pPort:\s*)9001(,?)$/m
      configContent = configContent.replace(p2pPortRegex, `$1${p2pPort}$2`)

      // 写回配置文件
      fs.writeFileSync(configPath, configContent)

      this.log(`更新配置文件 ${configPath} 完成`)
      return true
    } catch (error) {
      this.error(`更新配置文件失败: ${error}`)
      return false
    }
  }
}
