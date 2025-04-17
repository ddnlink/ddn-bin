/**
 * 配置生成和更新测试
 * 测试配置文件的生成和更新功能
 */

import * as fs from 'fs'
import * as path from 'path'

// 使用模拟的 Command 类
jest.mock('@oclif/core', () => require('./mocks/oclif'))

// 导入测试类
import { BaseCommand } from '../src/base-command'
import PeersStart from '../src/commands/peers/start'

// 模拟文件系统
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(),
  rmSync: jest.fn()
}))

describe('Config Generator', () => {
  let command: PeersStart

  beforeEach(() => {
    command = new PeersStart([], {} as any)
    jest.clearAllMocks()

    // 设置实际节点数量
    ;(command as any).actualPeerCount = 5
  })

  describe('generateConfig', () => {
    it('should generate correct config for fun-tests project', () => {
      const config = (command as any).generateConfig(8001, 9001, false, 'fun-tests')

      // 验证基本配置
      expect(config).toContain('port: 8001')
      expect(config).toContain('peerPort: 9001')
      expect(config).toContain('address: \'127.0.0.1\'')
      expect(config).toContain('publicIp: \'127.0.0.1\'')

      // 验证网络标识
      expect(config).toContain('nethash: \'fl3l5l3l5lk3kk3k\'')

      // 验证对等节点列表
      expect(config).toContain('peers: {')
      expect(config).toContain('list: [')

      // 不应包含自身
      expect(config).not.toContain('{ ip: \'127.0.0.1\', port: \'9001\', httpPort: \'8001\' }')

      // 应包含其他节点
      expect(config).toContain('{ ip: \'127.0.0.1\', port: \'9002\', httpPort: \'8002\' }')
      expect(config).toContain('{ ip: \'127.0.0.1\', port: \'9003\', httpPort: \'8003\' }')
      expect(config).toContain('{ ip: \'127.0.0.1\', port: \'9004\', httpPort: \'8004\' }')
      expect(config).toContain('{ ip: \'127.0.0.1\', port: \'9005\', httpPort: \'8005\' }')
    })

    it('should generate correct config for main-tests project', () => {
      const config = (command as any).generateConfig(8001, 9001, false, 'main-tests')

      // 验证基本配置
      expect(config).toContain('port: 8001')
      expect(config).toContain('peerPort: 9001')

      // 验证网络标识
      expect(config).toContain('nethash: \'da121d8d8d21a3d6\'')
    })

    it('should include genesis config when useGenesis is true', () => {
      const config = (command as any).generateConfig(8001, 9001, true, 'fun-tests')

      // 验证创世块配置
      expect(config).toContain('genesis: {')
      expect(config).toContain('delegates: [')
      expect(config).toContain('votes: [')
      expect(config).toContain('assets: [')
    })
  })

  describe('updateConfig', () => {
    it('should update port and peers list in existing config', () => {
      // 模拟文件系统
      const mockExistsSync = fs.existsSync as jest.Mock
      mockExistsSync.mockReturnValue(true)

      const mockReadFileSync = fs.readFileSync as jest.Mock
      mockReadFileSync.mockImplementation(() => {
        return `
module.exports = {
  port: 8001,
  peerPort: 9001,
  p2pPort: 9001,
  address: '127.0.0.1',
  publicIp: '127.0.0.1',
  logLevel: 'debug',
  nethash: 'fl3l5l3l5lk3kk3k',
  peers: {
    list: [
      { ip: '127.0.0.1', port: '9002', httpPort: '8002' },
      { ip: '127.0.0.1', port: '9003', httpPort: '8003' }
    ],
    blackList: [],
    options: {
      timeout: 4000
    }
  }
}
        `
      })

      const mockWriteFileSync = fs.writeFileSync as jest.Mock

      // 测试更新配置
      const result = (command as any).updateConfig('/test/config.js', 8003, 9003, 'fun-tests')

      // 验证结果
      expect(result).toBe(true)
      expect(mockWriteFileSync).toHaveBeenCalled()

      // 验证更新的配置
      const updatedConfig = mockWriteFileSync.mock.calls[0][1]
      expect(updatedConfig).toContain('port: 8003')
      expect(updatedConfig).toContain('p2pPort: 9003')

      // 验证对等节点列表
      expect(updatedConfig).toContain('peers: {')
      expect(updatedConfig).toContain('list: [')

      // 不应包含自身
      expect(updatedConfig).not.toContain('{ ip: \'127.0.0.1\', port: \'9003\', httpPort: \'8003\' }')

      // 应包含其他节点
      expect(updatedConfig).toContain('{ ip: \'127.0.0.1\', port: \'9001\', httpPort: \'8001\' }')
      expect(updatedConfig).toContain('{ ip: \'127.0.0.1\', port: \'9002\', httpPort: \'8002\' }')
      expect(updatedConfig).toContain('{ ip: \'127.0.0.1\', port: \'9004\', httpPort: \'8004\' }')
      expect(updatedConfig).toContain('{ ip: \'127.0.0.1\', port: \'9005\', httpPort: \'8005\' }')
    })

    it('should handle errors gracefully', () => {
      // 模拟文件系统错误
      const mockExistsSync = fs.existsSync as jest.Mock
      mockExistsSync.mockReturnValue(true)

      const mockReadFileSync = fs.readFileSync as jest.Mock
      mockReadFileSync.mockImplementation(() => {
        throw new Error('File read error')
      })

      // 模拟 error 方法
      const errorSpy = jest.spyOn(command, 'error').mockImplementation(() => {
        throw new Error('Command error')
      })

      // 测试更新配置
      expect(() => {
        (command as any).updateConfig('/test/config.js', 8003, 9003, 'fun-tests')
      }).toThrow('Command error')

      // 验证错误处理
      expect(errorSpy).toHaveBeenCalled()
      expect(errorSpy.mock.calls[0][0]).toContain('更新配置文件失败')

      errorSpy.mockRestore()
    })
  })
});
