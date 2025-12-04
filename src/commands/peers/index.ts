import { Command } from '@oclif/core'

export default class Peers extends Command {
  static description = 'DDN多节点管理命令'

  static examples = [
    '$ ddn-bin peers:start',
    '$ ddn-bin peers:stop',
    '$ ddn-bin peers:clean',
    '$ ddn-bin peers:monitor',
  ]

  async run(): Promise<void> {
    this.log('DDN多节点管理工具')
    this.log('')
    this.log('可用命令:')
    this.log('  peers:start    - 启动多个DDN节点')
    this.log('  peers:stop     - 停止多个DDN节点')
    this.log('  peers:clean    - 清理多个DDN节点的数据和日志')
    this.log('  peers:monitor  - 监控多个DDN节点的状态')
    this.log('')
    this.log('使用 --help 查看每个命令的详细帮助')
  }
}
