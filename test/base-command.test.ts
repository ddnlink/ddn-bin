import * as fs from 'fs'
import * as path from 'path'

// 使用模拟的 Command 类
jest.mock('@oclif/core', () => require('./mocks/oclif'))

// 导入 BaseCommand
import { BaseCommand } from '../src/base-command'

// 创建一个测试用的 BaseCommand 子类
class TestCommand extends BaseCommand {
  async run() {
    // 空实现
  }
}

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
    // 模拟执行命令
    if (cmd.includes('lsof -i :8001')) {
      callback(null, 'COMMAND  PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME\nnode    1234 user   17u  IPv4 123456      0t0  TCP *:8001 (LISTEN)', '')
    } else if (cmd.includes('lsof -i :8002')) {
      callback(new Error('No process found'), '', '')
    } else if (cmd.includes('curl -s "http://localhost:8001/api/blocks/getstatus"')) {
      callback(null, '{"success":true,"height":100}', '')
    } else if (cmd.includes('curl -s "http://localhost:8002/api/blocks/getstatus"')) {
      callback(new Error('Connection refused'), '', 'Connection refused')
    } else {
      callback(null, 'Command executed successfully', '')
    }
  }),
  execSync: jest.fn()
}))

describe('BaseCommand', () => {
  let command: TestCommand

  beforeEach(() => {
    command = new TestCommand([], {} as any)
    jest.clearAllMocks()
  })

  describe('getProjectRoot', () => {
    it('should find project root with examples directory', () => {
      // 模拟文件系统
      const mockExistsSync = fs.existsSync as jest.Mock
      mockExistsSync.mockImplementation((path: string) => {
        return path.includes('/examples')
      })

      // 使用 spyOn 来模拟 process.cwd()
      const cwdSpy = jest.spyOn(process, 'cwd')
      cwdSpy.mockReturnValue('/Users/test/projects/ddn')

      const result = (command as any).getProjectRoot()
      expect(result).toBe('/Users/test/projects/ddn')

      cwdSpy.mockRestore()
    })

    it('should return current directory if examples not found', () => {
      // 模拟文件系统
      const mockExistsSync = fs.existsSync as jest.Mock
      mockExistsSync.mockReturnValue(false)

      // 使用 spyOn 来模拟 process.cwd()
      const cwdSpy = jest.spyOn(process, 'cwd')
      cwdSpy.mockReturnValue('/Users/test/projects/ddn')

      const result = (command as any).getProjectRoot()
      expect(result).toBe('/Users/test/projects/ddn')

      cwdSpy.mockRestore()
    })
  })

  describe('getPeerDir', () => {
    it('should return correct peer directory path', () => {
      // 模拟 getExamplesDir 方法
      jest.spyOn(command as any, 'getExamplesDir').mockReturnValue('/Users/test/projects/ddn/examples')

      const result = (command as any).getPeerDir(8001, 'fun-tests')
      expect(result).toBe('/Users/test/projects/ddn/examples/peer-8001')
    })
  })

  describe('checkPortInUse', () => {
    it('should return true if port is in use', async () => {
      const result = await (command as any).checkPortInUse(8001)
      expect(result).toBe(true)
    })

    it('should return false if port is not in use', async () => {
      const result = await (command as any).checkPortInUse(8002)
      expect(result).toBe(false)
    })
  })

  describe('executeCommand', () => {
    it('should return success and output for successful command', async () => {
      const result = await (command as any).executeCommand('echo "test"')
      expect(result).toEqual({
        success: true,
        output: 'Command executed successfully'
      })
    })
  })

  describe('checkPeerHealth', () => {
    it('should return true if peer is healthy', async () => {
      const result = await (command as any).checkPeerHealth(8001, 1)
      expect(result).toBe(true)
    })

    it('should return false if peer is not healthy', async () => {
      const result = await (command as any).checkPeerHealth(8002, 1)
      expect(result).toBe(false)
    })
  })

  describe('distributeSecrets', () => {
    it('should distribute secrets evenly', () => {
      // 模拟文件系统
      const mockExistsSync = fs.existsSync as jest.Mock
      mockExistsSync.mockImplementation((path: string) => {
        return !path.includes('.config_prepared')
      })

      const mockReadFileSync = fs.readFileSync as jest.Mock
      mockReadFileSync.mockImplementation(() => {
        return `
module.exports = {
  forging: {
    secret: [
      'secret1',
      'secret2',
      'secret3',
      'secret4',
      'secret5',
      'secret6',
      'secret7',
      'secret8',
      'secret9',
      'secret10'
    ]
  }
}
        `
      })

      const mockWriteFileSync = fs.writeFileSync as jest.Mock

      // 测试分配算法
      (command as any).distributeSecrets('/test/config.js', 1, 3)

      // 验证写入的配置
      expect(mockWriteFileSync).toHaveBeenCalled()
      const writeCall = mockWriteFileSync.mock.calls[0]
      expect(writeCall[0]).toBe('/test/config.js')

      // 第一个节点应该分配到 4 个密钥 (10 / 3 = 3 余 1，所以第一个节点多分配一个)
      expect(writeCall[1]).toContain('secret1')
      expect(writeCall[1]).toContain('secret2')
      expect(writeCall[1]).toContain('secret3')
      expect(writeCall[1]).toContain('secret4')
      expect(writeCall[1]).not.toContain('secret5')
    })

    it('should skip if config is already prepared', () => {
      // 模拟文件系统
      const mockExistsSync = fs.existsSync as jest.Mock
      mockExistsSync.mockReturnValue(true)

      const mockWriteFileSync = fs.writeFileSync as jest.Mock

      // 测试分配算法
      const result = (command as any).distributeSecrets('/test/config.js', 1, 3)

      // 验证结果
      expect(result).toBe(true)
      expect(mockWriteFileSync).not.toHaveBeenCalled()
    })
  })
})
