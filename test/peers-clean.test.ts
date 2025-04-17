/**
 * peers:clean 命令测试
 * 测试清理节点数据的功能
 */

import * as fs from 'fs'
import * as path from 'path'

// 使用模拟的 Command 类
jest.mock('@oclif/core', () => require('./mocks/oclif'))

// 导入测试类
import PeersClean from '../src/commands/peers/clean'

// 模拟文件系统
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  readdirSync: jest.fn(),
  unlinkSync: jest.fn(),
  rmdirSync: jest.fn(),
  statSync: jest.fn()
}))

describe('PeersClean Command', () => {
  let command: PeersClean

  beforeEach(() => {
    command = new PeersClean([], {} as any)
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
    it('should clean the specified number of nodes', async () => {
      // 模拟 parse 方法
      jest.spyOn(command as any, 'parse').mockResolvedValue({
        flags: {
          count: 3,
          cleanType: 'all',
          file: undefined,
          port: undefined,
          project: 'fun-tests'
        }
      })

      // 模拟 cleanSinglePeer 方法
      const cleanSinglePeerSpy = jest.spyOn(command as any, 'cleanSinglePeer').mockResolvedValue(undefined)

      // 执行命令
      await command.run()

      // 验证结果
      expect(cleanSinglePeerSpy).toHaveBeenCalledTimes(3)
      expect(cleanSinglePeerSpy).toHaveBeenCalledWith(8001, 'all', undefined, 'fun-tests')
      expect(cleanSinglePeerSpy).toHaveBeenCalledWith(8002, 'all', undefined, 'fun-tests')
      expect(cleanSinglePeerSpy).toHaveBeenCalledWith(8003, 'all', undefined, 'fun-tests')
    })

    it('should clean a single node when port is specified', async () => {
      // 模拟 parse 方法
      jest.spyOn(command as any, 'parse').mockResolvedValue({
        flags: {
          count: 5,
          cleanType: 'db',
          file: 'blockchain',
          port: 8002,
          project: 'fun-tests'
        }
      })

      // 模拟 cleanSinglePeer 方法
      const cleanSinglePeerSpy = jest.spyOn(command as any, 'cleanSinglePeer').mockResolvedValue(undefined)

      // 执行命令
      await command.run()

      // 验证结果
      expect(cleanSinglePeerSpy).toHaveBeenCalledTimes(1)
      expect(cleanSinglePeerSpy).toHaveBeenCalledWith(8002, 'db', 'blockchain', 'fun-tests')
    })
  })

  describe('cleanSinglePeer', () => {
    it('should skip if peer directory does not exist', async () => {
      // 模拟 getPeerDir 方法
      jest.spyOn(command as any, 'getPeerDir').mockReturnValue('/test/peer-8001')

      // 模拟文件系统
      const mockExistsSync = fs.existsSync as jest.Mock
      mockExistsSync.mockReturnValue(false)

      // 执行方法
      await (command as any).cleanSinglePeer(8001, 'all', undefined, 'fun-tests')

      // 验证结果
      expect(command.log).toHaveBeenCalledWith(expect.stringContaining('节点目录 /test/peer-8001 不存在'))
      expect(fs.readdirSync).not.toHaveBeenCalled()
      expect(fs.unlinkSync).not.toHaveBeenCalled()
    })

    it('should clean db files when cleanType is db', async () => {
      // 模拟 getPeerDir 方法
      jest.spyOn(command as any, 'getPeerDir').mockReturnValue('/test/peer-8001')

      // 模拟文件系统
      const mockExistsSync = fs.existsSync as jest.Mock
      mockExistsSync.mockImplementation((path) => {
        return path.includes('/test/peer-8001') || path.includes('/db')
      })

      const mockReaddirSync = fs.readdirSync as jest.Mock
      mockReaddirSync.mockReturnValue(['blockchain.db', 'other.db'])

      const mockStatSync = fs.statSync as jest.Mock
      mockStatSync.mockReturnValue({ isFile: () => true })

      // 执行方法
      await (command as any).cleanSinglePeer(8001, 'db', undefined, 'fun-tests')

      // 验证结果
      expect(fs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining('blockchain.db'))
      expect(fs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining('other.db'))
    })

    it('should clean specific db file when file is specified', async () => {
      // 模拟 getPeerDir 方法
      jest.spyOn(command as any, 'getPeerDir').mockReturnValue('/test/peer-8001')

      // 模拟文件系统
      const mockExistsSync = fs.existsSync as jest.Mock
      mockExistsSync.mockImplementation((path) => {
        return path.includes('/test/peer-8001') || path.includes('/db')
      })

      const mockReaddirSync = fs.readdirSync as jest.Mock
      mockReaddirSync.mockReturnValue(['blockchain.db', 'peer.db'])

      const mockStatSync = fs.statSync as jest.Mock
      mockStatSync.mockReturnValue({ isFile: () => true })

      // 执行方法
      await (command as any).cleanSinglePeer(8001, 'db', 'blockchain', 'fun-tests')

      // 验证结果
      expect(fs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining('blockchain.db'))
      expect(fs.unlinkSync).not.toHaveBeenCalledWith(expect.stringContaining('peer.db'))
    })

    it('should clean log files when cleanType is log', async () => {
      // 模拟 getPeerDir 方法
      jest.spyOn(command as any, 'getPeerDir').mockReturnValue('/test/peer-8001')

      // 模拟文件系统
      const mockExistsSync = fs.existsSync as jest.Mock
      mockExistsSync.mockImplementation((path) => {
        return path.includes('/test/peer-8001') || path.includes('/logs')
      })

      const mockReaddirSync = fs.readdirSync as jest.Mock
      mockReaddirSync.mockReturnValue(['debug.log', 'error.log'])

      const mockStatSync = fs.statSync as jest.Mock
      mockStatSync.mockReturnValue({ isFile: () => true })

      // 执行方法
      await (command as any).cleanSinglePeer(8001, 'log', undefined, 'fun-tests')

      // 验证结果
      expect(fs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining('debug.log'))
      expect(fs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining('error.log'))
    })

    it('should clean pid files when cleanType is pid', async () => {
      // 模拟 getPeerDir 方法
      jest.spyOn(command as any, 'getPeerDir').mockReturnValue('/test/peer-8001')

      // 模拟文件系统
      const mockExistsSync = fs.existsSync as jest.Mock
      mockExistsSync.mockImplementation((path) => {
        return path.includes('/test/peer-8001')
      })

      const mockReaddirSync = fs.readdirSync as jest.Mock
      mockReaddirSync.mockReturnValue(['ddn.pid'])

      const mockStatSync = fs.statSync as jest.Mock
      mockStatSync.mockReturnValue({ isFile: () => true })

      // 执行方法
      await (command as any).cleanSinglePeer(8001, 'pid', undefined, 'fun-tests')

      // 验证结果
      expect(fs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining('ddn.pid'))
    })

    it('should clean all files when cleanType is all', async () => {
      // 模拟 getPeerDir 方法
      jest.spyOn(command as any, 'getPeerDir').mockReturnValue('/test/peer-8001')

      // 模拟 cleanSinglePeer 方法的递归调用
      const cleanSinglePeerSpy = jest.spyOn(command as any, 'cleanSinglePeer')
        .mockImplementationOnce(async () => {}) // 原始调用
        .mockResolvedValue(undefined) // 后续递归调用

      // 执行方法
      await (command as any).cleanSinglePeer(8001, 'all', undefined, 'fun-tests')

      // 验证结果
      expect(cleanSinglePeerSpy).toHaveBeenCalledWith(8001, 'db', undefined, 'fun-tests')
      expect(cleanSinglePeerSpy).toHaveBeenCalledWith(8001, 'log', undefined, 'fun-tests')
      expect(cleanSinglePeerSpy).toHaveBeenCalledWith(8001, 'pid', undefined, 'fun-tests')
    })
  })
});
