/**
 * peers:start 命令测试
 * 测试启动节点的功能
 */

import * as fs from 'fs'
import * as path from 'path'

// 使用模拟的 Command 类
jest.mock('@oclif/core', () => require('./mocks/oclif'))

// 导入测试类
import PeersStart from '../src/commands/peers/start'

// 模拟文件系统和子进程
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(),
  rmSync: jest.fn(),
  copyFileSync: jest.fn()
}))

jest.mock('child_process', () => ({
  exec: jest.fn((cmd, callback) => {
    if (cmd.includes('lsof -i :8001')) {
      callback(null, '', '') // 端口未被占用
    } else if (cmd.includes('lsof -i :8002')) {
      callback(null, 'COMMAND  PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME\nnode    1234 user   17u  IPv4 123456      0t0  TCP *:8002 (LISTEN)', '') // 端口被占用
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

describe('PeersStart Command', () => {
  let command: PeersStart

  beforeEach(() => {
    command = new PeersStart([], {} as any)
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
    it('should start the specified number of nodes', async () => {
      // 模拟 parse 方法
      jest.spyOn(command as any, 'parse').mockResolvedValue({
        flags: {
          count: 3,
          force: false,
          port: undefined,
          genesis: false,
          project: 'fun-tests'
        }
      })

      // 模拟文件系统
      const mockExistsSync = fs.existsSync as jest.Mock
      mockExistsSync.mockReturnValue(true)

      // 模拟 startSinglePeer 方法
      const startSinglePeerSpy = jest.spyOn(command as any, 'startSinglePeer').mockResolvedValue(undefined)

      // 执行命令
      await command.run()

      // 验证结果
      expect(startSinglePeerSpy).toHaveBeenCalledTimes(3)
      expect(startSinglePeerSpy).toHaveBeenCalledWith(8001, false, false, 'fun-tests')
      expect(startSinglePeerSpy).toHaveBeenCalledWith(8002, false, false, 'fun-tests')
      expect(startSinglePeerSpy).toHaveBeenCalledWith(8003, false, false, 'fun-tests')

      // 验证 actualPeerCount 设置正确
      expect((command as any).actualPeerCount).toBe(3)
    })

    it('should start a single node when port is specified', async () => {
      // 模拟 parse 方法
      jest.spyOn(command as any, 'parse').mockResolvedValue({
        flags: {
          count: 5,
          force: false,
          port: 8002,
          genesis: false,
          project: 'fun-tests'
        }
      })

      // 模拟文件系统
      const mockExistsSync = fs.existsSync as jest.Mock
      mockExistsSync.mockReturnValue(true)

      // 模拟 startSinglePeer 方法
      const startSinglePeerSpy = jest.spyOn(command as any, 'startSinglePeer').mockResolvedValue(undefined)

      // 执行命令
      await command.run()

      // 验证结果
      expect(startSinglePeerSpy).toHaveBeenCalledTimes(1)
      expect(startSinglePeerSpy).toHaveBeenCalledWith(8002, false, false, 'fun-tests')

      // 验证 actualPeerCount 设置正确
      expect((command as any).actualPeerCount).toBe(5)
    })
  })

  describe('startSinglePeer', () => {
    it('should skip if port is in use and force is false', async () => {
      // 模拟 checkPortInUse 方法
      jest.spyOn(command as any, 'checkPortInUse').mockResolvedValue(true)

      // 执行方法
      await (command as any).startSinglePeer(8001, false, false, 'fun-tests')

      // 验证结果
      expect(command.log).toHaveBeenCalledWith(expect.stringContaining('端口 8001 已被占用'))
      expect(fs.mkdirSync).not.toHaveBeenCalled()
      expect(fs.writeFileSync).not.toHaveBeenCalled()
    })

    it('should create new config if directory does not exist', async () => {
      // 模拟 checkPortInUse 方法
      jest.spyOn(command as any, 'checkPortInUse').mockResolvedValue(false)

      // 模拟文件系统
      const mockExistsSync = fs.existsSync as jest.Mock
      mockExistsSync.mockReturnValue(false)

      // 模拟其他方法
      jest.spyOn(command as any, 'getPeerDir').mockReturnValue('/test/peer-8001')
      jest.spyOn(command as any, 'copyTemplateDir').mockReturnValue(true)
      jest.spyOn(command as any, 'generateConfig').mockReturnValue('module.exports = {}')
      jest.spyOn(command as any, 'updateConfig').mockReturnValue(true)
      jest.spyOn(command as any, 'distributeSecrets').mockReturnValue(true)
      jest.spyOn(command as any, 'checkPeerHealth').mockResolvedValue(true)

      // 执行方法
      await (command as any).startSinglePeer(8001, false, false, 'fun-tests')

      // 验证结果
      expect(command.log).toHaveBeenCalledWith(expect.stringContaining('启动端口为 8001 的节点'))
      expect(fs.writeFileSync).toHaveBeenCalled()
    })

    it('should update config if directory exists', async () => {
      // 模拟 checkPortInUse 方法
      jest.spyOn(command as any, 'checkPortInUse').mockResolvedValue(false)

      // 模拟文件系统
      const mockExistsSync = fs.existsSync as jest.Mock
      mockExistsSync.mockImplementation((path) => {
        return !path.includes('.config_prepared')
      })

      // 模拟其他方法
      jest.spyOn(command as any, 'getPeerDir').mockReturnValue('/test/peer-8001')
      jest.spyOn(command as any, 'updateConfig').mockReturnValue(true)
      jest.spyOn(command as any, 'distributeSecrets').mockReturnValue(true)
      jest.spyOn(command as any, 'checkPeerHealth').mockResolvedValue(true)

      // 执行方法
      await (command as any).startSinglePeer(8001, false, false, 'fun-tests')

      // 验证结果
      expect(command.log).toHaveBeenCalledWith(expect.stringContaining('启动端口为 8001 的节点'))
      expect(fs.writeFileSync).not.toHaveBeenCalled()
    })

    it('should skip secret distribution if directory exists and force is false', async () => {
      // 模拟 checkPortInUse 方法
      jest.spyOn(command as any, 'checkPortInUse').mockResolvedValue(false)

      // 模拟文件系统
      const mockExistsSync = fs.existsSync as jest.Mock
      mockExistsSync.mockReturnValue(true)

      // 模拟其他方法
      jest.spyOn(command as any, 'getPeerDir').mockReturnValue('/test/peer-8001')
      jest.spyOn(command as any, 'updateConfig').mockReturnValue(true)
      const distributeSecretsSpy = jest.spyOn(command as any, 'distributeSecrets').mockReturnValue(true)
      jest.spyOn(command as any, 'checkPeerHealth').mockResolvedValue(true)

      // 执行方法
      await (command as any).startSinglePeer(8001, false, false, 'fun-tests')

      // 验证结果
      expect(command.log).toHaveBeenCalledWith(expect.stringContaining('跳过密钥分配'))
      expect(distributeSecretsSpy).not.toHaveBeenCalled()
    })

    it('should distribute secrets if directory exists and force is true', async () => {
      // 模拟 checkPortInUse 方法
      jest.spyOn(command as any, 'checkPortInUse').mockResolvedValue(false)

      // 模拟文件系统
      const mockExistsSync = fs.existsSync as jest.Mock
      mockExistsSync.mockReturnValue(true)

      // 模拟其他方法
      jest.spyOn(command as any, 'getPeerDir').mockReturnValue('/test/peer-8001')
      jest.spyOn(command as any, 'copyTemplateDir').mockReturnValue(true)
      jest.spyOn(command as any, 'updateConfig').mockReturnValue(true)
      const distributeSecretsSpy = jest.spyOn(command as any, 'distributeSecrets').mockReturnValue(true)
      jest.spyOn(command as any, 'checkPeerHealth').mockResolvedValue(true)

      // 执行方法
      await (command as any).startSinglePeer(8001, true, false, 'fun-tests')

      // 验证结果
      expect(distributeSecretsSpy).toHaveBeenCalled()
    })
  })
});
