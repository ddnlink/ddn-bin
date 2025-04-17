import { Flags } from '@oclif/core'
import * as fs from 'fs'
import * as path from 'path'
import { BaseCommand } from '../../base-command'

export default class PeersClean extends BaseCommand {
  static description = '清理多个DDN节点的数据和日志'

  static examples = [
    '$ ddn-scripts peers:clean',
    '$ ddn-scripts peers:clean -n 3',
    '$ ddn-scripts peers:clean -c db',
    '$ ddn-scripts peers:clean -f blockchain',
    '$ ddn-scripts peers:clean -t main-tests',
  ]

  static flags = {
    count: Flags.integer({
      char: 'n',
      description: '要清理的节点数量',
      default: BaseCommand.defaultPeerCount,
    }),
    cleanType: Flags.string({
      char: 'c',
      description: '清理类型 (db|log|pid|all)',
      default: 'all',
      options: ['db', 'log', 'pid', 'all'],
    }),
    file: Flags.string({
      char: 'f',
      description: '指定要清理的文件 (debug|dvm|main|blockchain|peer)',
      options: ['debug', 'dvm', 'main', 'blockchain', 'peer'],
    }),
    port: Flags.integer({
      char: 'p',
      description: '指定要清理的单个节点端口',
    }),
    project: BaseCommand.baseFlags.project,
    help: Flags.help({ char: 'h' }),
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(PeersClean)
    const peerCount = flags.count
    const basePort = BaseCommand.basePort
    const cleanType = flags.cleanType
    const cleanFile = flags.file
    const specificPort = flags.port
    const projectType = flags.project

    this.log(`使用项目: ${projectType}`)

    if (specificPort) {
      await this.cleanSinglePeer(specificPort, cleanType, cleanFile, projectType)
    } else {
      this.log(`准备清理 ${peerCount} 个节点...`)
      for (let i = 1; i <= peerCount; i++) {
        const port = basePort + i - 1
        await this.cleanSinglePeer(port, cleanType, cleanFile, projectType)
      }
      this.log('所有节点清理完成')
    }
  }

  private async cleanSinglePeer(port: number, cleanType: string, cleanFile?: string, projectType?: string): Promise<void> {
    const peerDir = this.getPeerDir(port, projectType || 'fun-tests')

    if (!fs.existsSync(peerDir)) {
      this.log(`警告: 目录 ${peerDir} 不存在，跳过...`)
      return
    }

    // 计算 P2P 端口
    const p2pPort = BaseCommand.p2pBasePort + (port - BaseCommand.basePort)

    // 检查 HTTP 端口是否正在运行
    const isHttpPortInUse = await this.checkPortInUse(port)
    // 检查 P2P 端口是否正在运行
    const isP2pPortInUse = await this.checkPortInUse(p2pPort)

    if (isHttpPortInUse || isP2pPortInUse) {
      this.log(`警告: 节点 ${port} 仍在运行，请先停止节点`)
      return
    }

    // 删除配置标记文件
    if (fs.existsSync(path.join(peerDir, '.config_prepared'))) {
      fs.unlinkSync(path.join(peerDir, '.config_prepared'))
    }

    if (cleanFile) {
      await this.cleanSpecificFile(peerDir, cleanFile)
    } else {
      switch (cleanType) {
        case 'db':
          await this.cleanDb(peerDir)
          break
        case 'log':
          await this.cleanLogs(peerDir)
          break
        case 'pid':
          await this.cleanPids(peerDir)
          break
        case 'all':
          await this.cleanDb(peerDir)
          await this.cleanLogs(peerDir)
          await this.cleanPids(peerDir)
          this.log(`已清理所有文件: ${peerDir}`)
          break
      }
    }
  }

  private async cleanSpecificFile(peerDir: string, fileName: string): Promise<void> {
    switch (fileName) {
      case 'debug':
        this.removeFile(path.join(peerDir, 'logs', 'debug.log'))
        break
      case 'dvm':
        this.removeFile(path.join(peerDir, 'logs', 'dvm.log'))
        break
      case 'main':
        this.removeFile(path.join(peerDir, 'logs', 'main.log'))
        break
      case 'blockchain':
        this.removeFile(path.join(peerDir, 'db', 'blockchain.db'))
        break
      case 'peer':
        this.removeFile(path.join(peerDir, 'db', 'peer.db'))
        break
    }
  }

  private async cleanDb(peerDir: string): Promise<void> {
    this.removeFile(path.join(peerDir, 'db', 'blockchain.db'))
    this.removeFile(path.join(peerDir, 'db', 'peer.db'))
    this.removeFile(path.join(peerDir, 'db', 'delegates.db'))
    this.log(`已清理数据库文件: ${path.join(peerDir, 'db')}`)
  }

  private async cleanLogs(peerDir: string): Promise<void> {
    this.removeFile(path.join(peerDir, 'logs', 'debug.log'))
    this.removeFile(path.join(peerDir, 'logs', 'dvm.log'))
    this.removeFile(path.join(peerDir, 'logs', 'main.log'))
    this.log(`已清理日志文件: ${path.join(peerDir, 'logs')}`)
  }

  private async cleanPids(peerDir: string): Promise<void> {
    this.removeFile(path.join(peerDir, 'ddn.pid'))
    this.log(`已清理pid文件: ${path.join(peerDir, 'ddn.pid')}`)
  }

  private removeFile(filePath: string): void {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
      this.log(`已删除文件: ${filePath}`)
    }
  }
}
