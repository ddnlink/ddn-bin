/**
 * 集成测试
 * 测试多个命令的协同工作
 */

import * as fs from 'fs'
import * as path from 'path'

// 使用模拟的 Command 类
jest.mock('@oclif/core', () => require('./mocks/oclif'))

// 导入测试类
import PeersStart from '../src/commands/peers/start'
import PeersStop from '../src/commands/peers/stop'
import PeersClean from '../src/commands/peers/clean'

// 模拟文件系统和子进程
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(),
  rmSync: jest.fn(),
  copyFileSync: jest.fn(),
  readdirSync: jest.fn(),
  unlinkSync: jest.fn(),
  statSync: jest.fn()
}))

jest.mock('child_process', () => ({
  exec: jest.fn((cmd, callback) => {
    if (cmd.includes('lsof -i :8001')) {
      callback(null, '', '') // 端口未被占用
    } else if (cmd.includes('curl -s "http://localhost:8001/api/blocks/getstatus"')) {
      callback(null, '{"success":true,"height":100}', '')
    } else if (cmd.includes('app.js --daemon')) {
      callback(null, 'Node started successfully', '')
    } else {
      callback(null, 'Command executed successfully', '')
    }
  }),
  execSync: jest.fn()
}))

describe('Integration Tests', () => {
  let startCommand: PeersStart
  let stopCommand: PeersStop
  let cleanCommand: PeersClean

  beforeEach(() => {
    startCommand = new PeersStart([], {} as any)
    stopCommand = new PeersStop([], {} as any)
    cleanCommand = new PeersClean([], {} as any)

    jest.clearAllMocks()

    // 模拟 log 方法
    jest.spyOn(startCommand, 'log').mockImplementation(() => {})
    jest.spyOn(stopCommand, 'log').mockImplementation(() => {})
    jest.spyOn(cleanCommand, 'log').mockImplementation(() => {})

    // 模拟 error 方法
    jest.spyOn(startCommand, 'error').mockImplementation((input: string | Error) => {
      const msg = input instanceof Error ? input.message : input
      throw new Error(msg)
    })
    jest.spyOn(stopCommand, 'error').mockImplementation((input: string | Error) => {
      const msg = input instanceof Error ? input.message : input
      throw new Error(msg)
    })
    jest.spyOn(cleanCommand, 'error').mockImplementation((input: string | Error) => {
      const msg = input instanceof Error ? input.message : input
      throw new Error(msg)
    })
  })

  describe('Full Lifecycle', () => {
    it('should start, stop and clean nodes correctly', async () => {
      // 模拟文件系统
      const mockExistsSync = fs.existsSync as jest.Mock
      mockExistsSync.mockReturnValue(true)

      // 模拟 parse 方法
      jest.spyOn(startCommand as any, 'parse').mockResolvedValue({
        flags: {
          count: 1,
          force: false,
          port: undefined,
          genesis: false,
          project: 'fun-tests'
        }
      })

      jest.spyOn(stopCommand as any, 'parse').mockResolvedValue({
        flags: {
          count: 1,
          force: true,
          port: undefined,
          project: 'fun-tests'
        }
      })

      jest.spyOn(cleanCommand as any, 'parse').mockResolvedValue({
        flags: {
          count: 1,
          cleanType: 'all',
          file: undefined,
          port: undefined,
          project: 'fun-tests'
        }
      })

      // 模拟启动命令相关方法
      jest.spyOn(startCommand as any, 'startSinglePeer').mockResolvedValue(undefined)

      // 模拟停止命令相关方法
      jest.spyOn(stopCommand as any, 'stopSinglePeer').mockResolvedValue(undefined)

      // 模拟清理命令相关方法
      jest.spyOn(cleanCommand as any, 'checkPortInUse').mockResolvedValue(false)

      // 1. 启动节点
      await startCommand.run()

      // 2. 停止节点
      await stopCommand.run()

      // 3. 清理节点
      await cleanCommand.run()

      // 验证结果
      // 验证启动过程
      expect(startCommand.log).toHaveBeenCalledWith(expect.stringContaining('准备启动 1 个节点'))

      // 验证停止过程
      expect(stopCommand.log).toHaveBeenCalledWith(expect.stringContaining('准备停止 1 个节点'))

      // 验证清理过程
      expect(cleanCommand.log).toHaveBeenCalledWith(expect.stringContaining('准备清理 1 个节点'))
      expect(fs.unlinkSync).toHaveBeenCalled()
    }, 10000) // 增加超时时间
  })

  describe('Error Handling', () => {
    it('should handle errors during startup', async () => {
      // 模拟 parse 方法
      jest.spyOn(startCommand as any, 'parse').mockResolvedValue({
        flags: {
          count: 1,
          force: false,
          port: undefined,
          genesis: false,
          project: 'fun-tests'
        }
      })

      // 模拟文件系统错误
      const mockExistsSync = fs.existsSync as jest.Mock
      mockExistsSync.mockReturnValue(true)

      // 模拟 checkPortInUse 方法
      jest.spyOn(startCommand as any, 'checkPortInUse').mockResolvedValue(false)

      // 模拟 executeCommand 方法失败
      jest.spyOn(startCommand as any, 'executeCommand').mockResolvedValue({
        success: false,
        output: 'Failed to start node'
      })

      // 执行命令并捕获错误
      try {
        await startCommand.run()
        fail('Should have thrown an error')
      } catch (error: any) {
        expect(error.message).toContain('节点 8001 启动失败')
      }
    })

    it('should skip cleanup if node is still running', async () => {
      // 模拟 parse 方法
      jest.spyOn(cleanCommand as any, 'parse').mockResolvedValue({
        flags: {
          count: 1,
          cleanType: 'db',
          file: undefined,
          port: undefined,
          project: 'fun-tests'
        }
      })

      // 模拟文件系统
      const mockExistsSync = fs.existsSync as jest.Mock
      mockExistsSync.mockReturnValue(true)

      // 模拟 getPeerDir 方法
      jest.spyOn(cleanCommand as any, 'getPeerDir').mockReturnValue('/test/peer-8001')

      // 模拟端口在使用中（节点正在运行）
      jest.spyOn(cleanCommand as any, 'checkPortInUse').mockResolvedValue(true)

      // 执行命令
      await cleanCommand.run()

      // 验证结果 - 应该提示节点仍在运行
      expect(cleanCommand.log).toHaveBeenCalledWith(expect.stringContaining('节点'))
      expect(cleanCommand.log).toHaveBeenCalledWith(expect.stringContaining('仍在运行'))
    })
  })
});
