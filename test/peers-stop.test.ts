/**
 * peers:stop 命令测试
 * 测试停止节点的功能
 */

import * as fs from 'fs'

// 使用模拟的 Command 类
jest.mock('@oclif/core', () => require('./mocks/oclif'))

// 导入测试类
import PeersStop from '../src/commands/peers/stop'

// 模拟文件系统和子进程
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  readFileSync: jest.fn()
}))

jest.mock('child_process', () => ({
  exec: jest.fn((cmd, callback) => {
    if (cmd.includes('lsof -i :8001')) {
      callback(null, 'COMMAND  PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME\nnode    1234 user   17u  IPv4 123456      0t0  TCP *:8001 (LISTEN)', '')
    } else if (cmd.includes('lsof -i :8002')) {
      callback(new Error('No process found'), '', '')
    } else if (cmd.includes('kill ')) {
      callback(null, 'Process terminated', '')
    } else if (cmd.includes('kill -9 ')) {
      callback(null, 'Process forcefully terminated', '')
    } else {
      callback(null, 'Command executed successfully', '')
    }
  })
}))

describe('PeersStop Command', () => {
  let command: PeersStop

  beforeEach(() => {
    command = new PeersStop([], {} as any)
    jest.clearAllMocks()

    // 模拟 log 方法
    jest.spyOn(command, 'log').mockImplementation(() => {})

    // 模拟 error 方法
    jest.spyOn(command, 'error').mockImplementation((input: string | Error) => {
      const msg = input instanceof Error ? input.message : input
      throw new Error(msg)
    })
  })

  describe('run', () => {
    it('should stop the specified number of nodes', async () => {
      // 模拟 parse 方法
      jest.spyOn(command as any, 'parse').mockResolvedValue({
        flags: {
          count: 3,
          force: false,
          port: undefined,
          project: 'fun-tests'
        }
      })

      // 模拟 stopSinglePeer 方法
      const stopSinglePeerSpy = jest.spyOn(command as any, 'stopSinglePeer').mockResolvedValue(undefined)

      // 执行命令
      await command.run()

      // 验证结果
      expect(stopSinglePeerSpy).toHaveBeenCalledTimes(3)
      expect(stopSinglePeerSpy).toHaveBeenCalledWith(8001, false, 'fun-tests')
      expect(stopSinglePeerSpy).toHaveBeenCalledWith(8002, false, 'fun-tests')
      expect(stopSinglePeerSpy).toHaveBeenCalledWith(8003, false, 'fun-tests')
    })

    it('should stop a single node when port is specified', async () => {
      // 模拟 parse 方法
      jest.spyOn(command as any, 'parse').mockResolvedValue({
        flags: {
          count: 5,
          force: false,
          port: 8002,
          project: 'fun-tests'
        }
      })

      // 模拟 stopSinglePeer 方法
      const stopSinglePeerSpy = jest.spyOn(command as any, 'stopSinglePeer').mockResolvedValue(undefined)

      // 执行命令
      await command.run()

      // 验证结果
      expect(stopSinglePeerSpy).toHaveBeenCalledTimes(1)
      expect(stopSinglePeerSpy).toHaveBeenCalledWith(8002, false, 'fun-tests')
    })
  })

  describe('stopSinglePeer', () => {
    it('should skip if peer directory does not exist', async () => {
      // 模拟 getPeerDir 方法
      jest.spyOn(command as any, 'getPeerDir').mockReturnValue('/test/peer-8002')

      // 模拟文件系统 - 目录不存在
      const mockExistsSync = fs.existsSync as jest.Mock
      mockExistsSync.mockReturnValue(false)

      // 执行方法
      await (command as any).stopSinglePeer(8002, false, 'fun-tests')

      // 验证结果 - 应该跳过停止
      expect(command.log).toHaveBeenCalledWith(expect.stringContaining('节点目录'))
      expect(command.log).toHaveBeenCalledWith(expect.stringContaining('不存在'))
    })

    it('should log no process found when port is not in use', async () => {
      // 模拟 getPeerDir 方法
      jest.spyOn(command as any, 'getPeerDir').mockReturnValue('/test/peer-8002')

      // 模拟文件系统 - 目录存在
      const mockExistsSync = fs.existsSync as jest.Mock
      mockExistsSync.mockReturnValue(true)

      // 模拟 executeCommand 方法 - 没有进程运行
      jest.spyOn(command as any, 'executeCommand').mockResolvedValue({ success: false, output: '' })

      // 执行方法
      await (command as any).stopSinglePeer(8002, false, 'fun-tests')

      // 验证结果
      expect(command.log).toHaveBeenCalledWith(expect.stringContaining('没有找到运行在 HTTP 端口 8002 上的进程'))
    })

    it('should terminate process when found', async () => {
      // 模拟 getPeerDir 方法
      jest.spyOn(command as any, 'getPeerDir').mockReturnValue('/test/peer-8001')

      // 模拟文件系统 - 目录存在
      const mockExistsSync = fs.existsSync as jest.Mock
      mockExistsSync.mockReturnValue(true)

      // 模拟 executeCommand 方法
      const executeCommandSpy = jest.spyOn(command as any, 'executeCommand')
        .mockResolvedValueOnce({ success: true, output: '1234' }) // lsof 找到进程
        .mockResolvedValueOnce({ success: true, output: '' }) // kill -15
        .mockResolvedValueOnce({ success: false, output: '' }) // kill -0 检查进程已退出
        .mockResolvedValueOnce({ success: false, output: '' }) // P2P 端口检查

      // 模拟 sleep 方法
      jest.spyOn(command as any, 'sleep').mockResolvedValue(undefined)

      // 执行方法
      await (command as any).stopSinglePeer(8001, false, 'fun-tests')

      // 验证结果 - 应该调用 kill 命令
      expect(executeCommandSpy).toHaveBeenCalledWith(expect.stringContaining('kill -15'))
      expect(command.log).toHaveBeenCalledWith(expect.stringContaining('已成功停止'))
    })

    it('should use SIGKILL if force is true', async () => {
      // 模拟 getPeerDir 方法
      jest.spyOn(command as any, 'getPeerDir').mockReturnValue('/test/peer-8001')

      // 模拟文件系统 - 目录存在
      const mockExistsSync = fs.existsSync as jest.Mock
      mockExistsSync.mockReturnValue(true)

      // 模拟 executeCommand 方法
      const executeCommandSpy = jest.spyOn(command as any, 'executeCommand')
        .mockResolvedValueOnce({ success: true, output: '1234' }) // lsof 找到进程
        .mockResolvedValueOnce({ success: true, output: '' }) // kill -9
        .mockResolvedValueOnce({ success: false, output: '' }) // P2P 端口检查

      // 执行方法
      await (command as any).stopSinglePeer(8001, true, 'fun-tests')

      // 验证结果 - 应该直接调用 kill -9
      expect(executeCommandSpy).toHaveBeenCalledWith(expect.stringContaining('kill -9'))
    })
  })
});
