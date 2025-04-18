import { Flags } from '@oclif/core'
import * as fs from 'fs'
import { BaseCommand } from '../../base-command'

export default class PeersMonitor extends BaseCommand {
  static description = '监控多个DDN节点的状态'

  static examples = [
    '$ ddn-bin peers:monitor',
    '$ ddn-bin peers:monitor -n 3',
    '$ ddn-bin peers:monitor -i 30',
    '$ ddn-bin peers:monitor -t main-tests',
  ]

  static flags = {
    count: Flags.integer({
      char: 'n',
      description: '要监控的节点数量',
      default: BaseCommand.defaultPeerCount,
    }),
    interval: Flags.integer({
      char: 'i',
      description: '监控间隔（秒）',
      default: 60,
    }),
    autoRestart: Flags.boolean({
      char: 'r',
      description: '发现异常时自动重启节点',
      default: false,
    }),
    project: BaseCommand.baseFlags.project,
    help: Flags.help({ char: 'h' }),
  }

  private running = true

  async run(): Promise<void> {
    const { flags } = await this.parse(PeersMonitor)
    const peerCount = flags.count
    const basePort = BaseCommand.basePort
    const interval = flags.interval
    const autoRestart = flags.autoRestart
    const projectType = flags.project

    this.log(`使用项目: ${projectType}`)
    this.log(`开始监控 ${peerCount} 个节点，间隔 ${interval} 秒...`)

    // 捕获 SIGINT 信号以便优雅退出
    process.on('SIGINT', () => {
      this.log('接收到中断信号，正在停止监控...')
      this.running = false
    })

    while (this.running) {
      this.log(`=============== ${new Date().toISOString()} ===============`)

      let unhealthyCount = 0
      for (let i = 1; i <= peerCount; i++) {
        const port = basePort + i - 1
        const isHealthy = await this.checkPeerStatus(port, projectType)
        if (!isHealthy) {
          unhealthyCount++
        }
      }

      if (unhealthyCount > 0 && autoRestart) {
        this.log(`发现 ${unhealthyCount} 个异常节点，准备重启...`)
        await this.restartUnhealthyPeers(peerCount, projectType)
      }

      if (this.running) {
        await this.sleep(interval * 1000)
      }
    }
  }

  private async checkPeerStatus(port: number, projectType: string): Promise<boolean> {
    try {
      // 检查节点目录是否存在
      const peerDir = this.getPeerDir(port, projectType)
      if (!fs.existsSync(peerDir)) {
        this.log(`节点目录 ${peerDir} 不存在，跳过检查`)
        return false
      }

      // 计算 P2P 端口
      const p2pPort = BaseCommand.p2pBasePort + (port - BaseCommand.basePort)

      // 检查 HTTP 端口是否在运行
      const isHttpRunning = await this.checkPortInUse(port)
      // 检查 P2P 端口是否在运行
      const isP2pRunning = await this.checkPortInUse(p2pPort)

      if (!isHttpRunning && !isP2pRunning) {
        this.log(`节点 ${port} 未运行（HTTP 端口和 P2P 端口都未启动）`)
        return false
      }

      if (!isHttpRunning) {
        this.log(`节点 ${port} 的 HTTP 端口未运行，但 P2P 端口 ${p2pPort} 在运行`)
        return false
      }

      // 检查API是否响应
      const { success, output } = await this.executeCommand(`curl -s -m 30 "http://127.0.0.1:${port}/api/blocks/getstatus"`)
      if (!success) {
        this.log(`节点 ${port} API 无响应`)
        return false
      }

      try {
        const response = JSON.parse(output)
        const height = response.height
        const blockTime = response.blockTime
        const now = Math.floor(Date.now() / 1000)

        if (now - blockTime > 300) {
          this.log(`节点 ${port} 超过5分钟未产生新区块，当前高度: ${height}`)
          return false
        }

        this.log(`节点 ${port} 状态正常: 高度=${height}, 最后区块时间=${new Date(blockTime * 1000).toISOString()}`)
        return true
      } catch (error) {
        this.log(`节点 ${port} 返回的数据无法解析: ${output}`)
        return false
      }
    } catch (error) {
      this.log(`检查节点 ${port} 状态时出错: ${error}`)
      return false
    }
  }

  private async restartUnhealthyPeers(peerCount: number, projectType: string): Promise<void> {
    // 停止所有节点
    this.log('停止所有节点...')
    await this.executeCommand(`cd ${process.cwd()} && ./bin/run peers:stop -n ${peerCount} -f -t ${projectType}`)

    // 等待节点完全停止
    await this.sleep(5000)

    // 清理数据库
    this.log('清理数据库...')
    await this.executeCommand(`cd ${process.cwd()} && ./bin/run peers:clean -n ${peerCount} -c db -t ${projectType}`)

    // 等待清理完成
    await this.sleep(2000)

    // 重新启动所有节点
    this.log('重新启动所有节点...')
    await this.executeCommand(`cd ${process.cwd()} && ./bin/run peers:start -n ${peerCount} -f -t ${projectType}`)

    // 等待节点启动
    await this.sleep(10000)

    // 检查节点状态
    this.log('检查节点状态...')
    let healthyCount = 0
    for (let i = 1; i <= peerCount; i++) {
      const port = BaseCommand.basePort + i - 1
      if (await this.checkPeerHealth(port, 5)) {
        healthyCount++
      }
    }

    this.log(`节点重启完成，${healthyCount}/${peerCount} 个节点运行正常`)
  }
}
