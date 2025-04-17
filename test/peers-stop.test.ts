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
    it('should skip if no process is running on the port', async () => {
      // 模拟 checkPortInUse 方法
      jest.spyOn(command as any, 'checkPortInUse').mockResolvedValue(false)

      // 执行方法
      await (command as any).stopSinglePeer(8002, false, 'fun-tests')

      // 验证结果
      expect(command.log).toHaveBeenCalledWith(expect.stringContaining('没有进程在端口 8002 上运行'))
    })

    it('should use SIGTERM if force is false', async () => {
      // 模拟 checkPortInUse 方法
      jest.spyOn(command as any, 'checkPortInUse').mockResolvedValue(true)

      // 模拟 executeCommand 方法
      const executeCommandSpy = jest.spyOn(command as any, 'executeCommand')

      // 执行方法
      await (command as any).stopSinglePeer(8001, false, 'fun-tests')

      // 验证结果
      expect(executeCommandSpy).toHaveBeenCalledWith(expect.stringContaining('kill '))
      expect(executeCommandSpy).not.toHaveBeenCalledWith(expect.stringContaining('kill -9 '))
    })

    it('should use SIGKILL if force is true', async () => {
      // 模拟 checkPortInUse 方法
      jest.spyOn(command as any, 'checkPortInUse').mockResolvedValue(true)

      // 模拟 executeCommand 方法
      const executeCommandSpy = jest.spyOn(command as any, 'executeCommand')

      // 执行方法
      await (command as any).stopSinglePeer(8001, true, 'fun-tests')

      // 验证结果
      expect(executeCommandSpy).toHaveBeenCalledWith(expect.stringContaining('kill -9 '))
    })

    it('should verify process is stopped', async () => {
      // 模拟 checkPortInUse 方法的两次调用
      const checkPortInUseSpy = jest.spyOn(command as any, 'checkPortInUse')
        .mockResolvedValueOnce(true)  // 第一次调用返回 true
        .mockResolvedValueOnce(false) // 第二次调用返回 false

      // 模拟 executeCommand 方法
      jest.spyOn(command as any, 'executeCommand').mockResolvedValue({ success: true, output: '' })

      // 模拟 sleep 方法
      jest.spyOn(command as any, 'sleep').mockResolvedValue(undefined)

      // 执行方法
      await (command as any).stopSinglePeer(8001, false, 'fun-tests')

      // 验证结果
      expect(checkPortInUseSpy).toHaveBeenCalledTimes(2)
      expect(command.log).toHaveBeenCalledWith(expect.stringContaining('节点 8001 已停止'))
    })
  })
});
