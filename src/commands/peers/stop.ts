import { Flags } from '@oclif/core'
import * as fs from 'fs'
import { BaseCommand } from '../../base-command'

export default class PeersStop extends BaseCommand {
  static description = '停止多个DDN节点'

  static examples = [
    '$ ddn-bin peers:stop',
    '$ ddn-bin peers:stop -n 3',
    '$ ddn-bin peers:stop -p 8001',
    '$ ddn-bin peers:stop -t main-tests',
  ]

  static flags = {
    count: Flags.integer({
      char: 'n',
      description: '要停止的节点数量',
      default: BaseCommand.defaultPeerCount,
    }),
    port: Flags.integer({
      char: 'p',
      description: '指定要停止的单个节点端口',
    }),
    force: Flags.boolean({
      char: 'f',
      description: '强制停止（使用 SIGKILL）',
      default: false,
    }),
    project: BaseCommand.baseFlags.project,
    help: Flags.help({ char: 'h' }),
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(PeersStop)
    const peerCount = flags.count
    const basePort = BaseCommand.basePort
    const specificPort = flags.port
    const force = flags.force
    const projectType = flags.project

    this.log(`使用项目: ${projectType}`)

    if (specificPort) {
      await this.stopSinglePeer(specificPort, force, projectType)
    } else {
      this.log(`准备停止 ${peerCount} 个节点...`)
      for (let i = 1; i <= peerCount; i++) {
        const port = basePort + i - 1
        await this.stopSinglePeer(port, force, projectType)
      }
      this.log('所有节点停止完成')
    }
  }

  private async stopSinglePeer(port: number, force: boolean, projectType: string): Promise<void> {
    this.log(`正在停止端口为 ${port} 的节点...`)

    // 检查节点目录是否存在
    const peerDir = this.getPeerDir(port, projectType)
    if (!fs.existsSync(peerDir)) {
      this.log(`节点目录 ${peerDir} 不存在，跳过停止`)
      return
    }

    // 计算 P2P 端口
    const p2pPort = BaseCommand.p2pBasePort + (port - BaseCommand.basePort)

    // 查找运行在 HTTP 端口上的进程
    const { success, output } = await this.executeCommand(`lsof -ti :${port}`)
    if (!success || !output.trim()) {
      this.log(`没有找到运行在 HTTP 端口 ${port} 上的进程`)

      // 检查 P2P 端口
      const p2pResult = await this.executeCommand(`lsof -ti :${p2pPort}`)
      if (!p2pResult.success || !p2pResult.output.trim()) {
        this.log(`没有找到运行在 P2P 端口 ${p2pPort} 上的进程`)
        return
      }

      // 如果找到 P2P 端口上的进程，则终止它
      const p2pPid = p2pResult.output.trim()
      this.log(`找到运行在 P2P 端口 ${p2pPort} 上的进程 ${p2pPid}`)
      await this.terminateProcess(p2pPid, force, `P2P 端口 ${p2pPort}`)
      return
    }

    const pid = output.trim()
    this.log(`找到运行在 HTTP 端口 ${port} 上的进程 ${pid}`)
    await this.terminateProcess(pid, force, `HTTP 端口 ${port}`)

    // 检查 P2P 端口是否有进程运行
    const p2pResult = await this.executeCommand(`lsof -ti :${p2pPort}`)
    if (p2pResult.success && p2pResult.output.trim()) {
      const p2pPid = p2pResult.output.trim()
      if (p2pPid !== pid) { // 如果不是同一个进程，则终止它
        this.log(`找到运行在 P2P 端口 ${p2pPort} 上的进程 ${p2pPid}`)
        await this.terminateProcess(p2pPid, force, `P2P 端口 ${p2pPort}`)
      }
    }
  }

  // 终止进程的辅助方法
  private async terminateProcess(pid: string, force: boolean, description: string): Promise<void> {
    // 尝试优雅地停止进程
    if (!force) {
      this.log(`尝试优雅停止 ${description} 上的进程...`)
      await this.executeCommand(`kill -15 ${pid}`)

      // 等待进程终止
      for (let i = 0; i < 10; i++) {
        await this.sleep(1000)
        const { success: checkSuccess } = await this.executeCommand(`kill -0 ${pid} 2>/dev/null`)
        if (!checkSuccess) {
          this.log(`${description} 上的进程已成功停止`)
          return
        }
      }

      this.log(`优雅停止超时，将强制终止 ${description} 上的进程`)
    }

    // 强制终止进程
    this.log(`强制终止 ${description} 上的进程...`)
    await this.executeCommand(`kill -9 ${pid}`)
    this.log(`${description} 上的进程已被强制停止`)
  }
}
