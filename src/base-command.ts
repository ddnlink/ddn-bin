import { Command, Flags } from '@oclif/core'
import * as path from 'path'
import * as fs from 'fs'

export abstract class BaseCommand extends Command {
  // 基础配置
  static basePort = 8001
  static p2pBasePort = 9001
  static defaultPeerCount = 5

  // 密钥配置
  static totalSecrets = 101
  static secretStartLine = 40

  // 项目类型
  static projectTypes = ['fun-tests', 'main-tests']
  static defaultProjectType = 'fun-tests'

  // 通用标志
  static baseFlags = {
    project: Flags.string({
      char: 't',
      description: '测试项目类型',
      default: BaseCommand.defaultProjectType,
      options: BaseCommand.projectTypes
    })
  }

  // 获取项目根目录
  protected getProjectRoot(): string {
    // 从当前工作目录向上查找，直到找到包含 examples 目录的目录
    let currentDir = process.cwd()
    while (currentDir !== '/') {
      if (fs.existsSync(path.join(currentDir, 'examples'))) {
        return currentDir
      }
      currentDir = path.dirname(currentDir)
    }

    // 如果找不到，则假设当前目录就是项目根目录
    return process.cwd()
  }

  // 获取 examples 目录路径
  protected getExamplesDir(): string {
    return path.join(this.getProjectRoot(), 'examples')
  }

  // 获取测试项目目录路径
  protected getTestProjectDir(projectType: string): string {
    return path.join(this.getExamplesDir(), projectType)
  }

  // 获取多节点目录路径
  protected getMultiPeersDir(projectType: string): string {
    return path.join(this.getTestProjectDir(projectType), 'multi-peers')
  }

  // 获取节点目录路径
  protected getPeerDir(port: number, _projectType?: string): string {
    // 节点目录应该与 fun-tests/main-tests 同级，直接在 examples 目录下
    // 注意: projectType 参数不再使用，但为了兼容性保留了参数
    return path.join(this.getExamplesDir(), `peer-${port}`)
  }

  // 辅助方法
  protected async checkPortInUse(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const { exec } = require('child_process')
      exec(`lsof -i :${port}`, (error: any, stdout: string) => {
        if (error) {
          resolve(false)
          return
        }
        resolve(stdout.trim().length > 0)
      })
    })
  }

  protected async executeCommand(command: string): Promise<{ success: boolean; output: string }> {
    return new Promise((resolve) => {
      const { exec } = require('child_process')
      exec(command, (error: any, stdout: string, stderr: string) => {
        if (error) {
          resolve({ success: false, output: stderr || error.message })
          return
        }
        resolve({ success: true, output: stdout })
      })
    })
  }

  protected async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // 复制模板目录
  protected copyTemplateDir(projectType: string, targetDir: string, force: boolean = false): boolean {
    // 使用项目目录作为模板源
    const templateDir = path.join(this.getExamplesDir(), projectType)

    // 检查模板目录是否存在
    if (!fs.existsSync(templateDir)) {
      this.log(`模板目录 ${templateDir} 不存在，将创建基本目录结构`)
      // 如果模板目录不存在，则创建基本目录结构
      this.createBasicDirStructure(targetDir)
      return true
    }

    // 如果目标目录已存在且不强制，则跳过
    if (fs.existsSync(targetDir) && !force) {
      this.log(`目录 ${targetDir} 已存在，跳过... (使用 -f 强制重建)`)
      return false
    }

    // 如果目标目录已存在且强制模式，则删除
    if (fs.existsSync(targetDir) && force) {
      this.log(`强制模式启用，删除目录 ${targetDir}...`)
      fs.rmSync(targetDir, { recursive: true, force: true })
    }

    // 创建目标目录
    fs.mkdirSync(targetDir, { recursive: true })

    // 使用 rsync 复制整个模板目录
    this.log(`复制模板目录 ${templateDir} 到 ${targetDir}`)

    try {
      // 使用 child_process.execSync 执行 rsync 命令
      const { execSync } = require('child_process')
      execSync(`rsync -a --exclude="peer-*" --exclude="multi-peers" "${templateDir}/" "${targetDir}/"`, { stdio: 'inherit' })

      // 复制配置文件
      const configSrc = path.join(templateDir, '.ddnrc.js')
      const configDest = path.join(targetDir, '.ddnrc.js')

      // 如果配置文件存在，直接复制
      if (fs.existsSync(configSrc)) {
        fs.copyFileSync(configSrc, configDest)
        this.log(`配置文件复制完成: ${configDest}`)
      } else {
        this.log(`警告: 模板配置文件 ${configSrc} 不存在`)
      }

      this.log(`模板目录复制完成`)
      return true
    } catch (error) {
      this.error(`复制模板目录失败: ${error}`)

      // 如果 rsync 失败，尝试使用原生 Node.js 方法复制
      this.log(`尝试使用原生方法复制...`)
      this.copyDirRecursiveSync(templateDir, targetDir)

      // 复制配置文件
      const configSrc = path.join(templateDir, '.ddnrc.js')
      const configDest = path.join(targetDir, '.ddnrc.js')

      if (fs.existsSync(configSrc)) {
        fs.copyFileSync(configSrc, configDest)
        this.log(`配置文件复制完成: ${configDest}`)
      }

      return true
    }
  }

  // 递归复制目录（当 rsync 失败时的备用方法）
  private copyDirRecursiveSync(src: string, dest: string) {
    const exists = fs.existsSync(src);
    if (!exists) {
      return;
    }

    const stats = fs.statSync(src);
    const isDirectory = stats.isDirectory();
    if (isDirectory) {
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
      }

      const entries = fs.readdirSync(src);

      for (const entry of entries) {
        // 跳过 peer-* 和 multi-peers 目录
        if (entry.startsWith('peer-') || entry === 'multi-peers') {
          continue;
        }

        const srcPath = path.join(src, entry);
        const destPath = path.join(dest, entry);

        this.copyDirRecursiveSync(srcPath, destPath);
      }
    } else {
      fs.copyFileSync(src, dest);
    }
  }

  // 创建基本目录结构
  private createBasicDirStructure(targetDir: string): void {
    // 创建目标目录
    fs.mkdirSync(targetDir, { recursive: true })

    // 创建必要的子目录
    fs.mkdirSync(path.join(targetDir, 'logs'), { recursive: true })
    fs.mkdirSync(path.join(targetDir, 'db'), { recursive: true })
    fs.mkdirSync(path.join(targetDir, 'public'), { recursive: true })
    fs.mkdirSync(path.join(targetDir, 'ssl'), { recursive: true })
  }

  // 分发密钥
  protected distributeSecrets(configPath: string, peerIndex: number, peerCount: number): boolean {
    // 检查配置文件是否存在
    if (!fs.existsSync(configPath)) {
      this.log(`配置文件 ${configPath} 不存在`)
      return false
    }

    // 检查是否已经分发密钥
    const peerDir = path.dirname(configPath)
    if (fs.existsSync(path.join(peerDir, '.config_prepared'))) {
      this.log(`配置已经准备完成，跳过密钥分发...`)
      return true
    }

    try {
      // 读取配置文件
      let configContent = fs.readFileSync(configPath, 'utf8')

      // 使用正则表达式提取 secret 数组
      const secretRegex = /secret:\s*\[([^\]]*?)\]/s
      const secretMatch = configContent.match(secretRegex)

      if (!secretMatch) {
        this.log(`在配置文件中找不到 secret 数组`)
        return false
      }

      // 提取原始的 secret 数组内容
      const originalSecrets = secretMatch[1].trim()

      // 如果原始 secret 数组为空，则跳过
      if (!originalSecrets) {
        this.log(`原始 secret 数组为空，跳过密钥分发`)
        // 标记配置已准备完成
        fs.writeFileSync(path.join(peerDir, '.config_prepared'), '')
        return true
      }

      // 将原始 secret 数组分割为行
      const secretLines = originalSecrets.split('\n').map(line => line.trim()).filter(line => line.length > 0)

      // 计算密钥分配的基本数量和剩余数量
      const totalSecrets = secretLines.length
      const baseSecretsPerPeer = Math.floor(totalSecrets / peerCount)
      const remainingSecrets = totalSecrets % peerCount

      // 计算当前节点应该分配的密钥数量
      // 前 remainingSecrets 个节点每个多分配一个密钥
      const currentNodeSecretCount = peerIndex <= remainingSecrets ? baseSecretsPerPeer + 1 : baseSecretsPerPeer

      // 计算当前节点的密钥起始位置
      let startIdx = 0
      if (peerIndex <= remainingSecrets) {
        // 前 remainingSecrets 个节点，每个节点分配 baseSecretsPerPeer + 1 个密钥
        startIdx = (peerIndex - 1) * (baseSecretsPerPeer + 1)
      } else {
        // 后面的节点，要考虑前面节点多分配的密钥
        startIdx = remainingSecrets * (baseSecretsPerPeer + 1) + (peerIndex - remainingSecrets - 1) * baseSecretsPerPeer
      }

      // 计算结束位置
      const endIdx = startIdx + currentNodeSecretCount

      // 提取当前节点的密钥
      const nodeSecrets = secretLines.slice(startIdx, endIdx)

      this.log(`节点 ${peerIndex}/${peerCount} 分配密钥范围: ${startIdx}-${endIdx-1}, 共 ${currentNodeSecretCount} 个密钥`)

      // 清理密钥行，移除末尾多余的逗号
      const cleanedSecrets = nodeSecrets.map(line => {
        // 移除行末的逗号
        return line.replace(/,+$/, '')
      })

      // 替换配置文件中的 secret 数组
      // 最后一个元素不需要逗号
      const lastIndex = cleanedSecrets.length - 1
      const formattedSecrets = cleanedSecrets.map((secret, index) => {
        if (index === lastIndex) {
          return secret
        } else {
          return secret + ','
        }
      })

      // 使用换行和缩进来格式化密钥数组
      const newSecretArray = formattedSecrets.join('\n      ')
      const newSecretSection = `secret: [\n      ${newSecretArray}\n    ]`

      // 替换配置文件中的 secret 部分
      configContent = configContent.replace(secretRegex, newSecretSection)

      // 写回配置文件
      fs.writeFileSync(configPath, configContent)

      // 使用正则表达式直接修复 secret 数组中的逗号问题
      let fileContent = fs.readFileSync(configPath, 'utf8')
      fileContent = fileContent.replace(/('.*?'),+,/g, "$1,")
      fs.writeFileSync(configPath, fileContent)

      // 标记配置已准备完成
      fs.writeFileSync(path.join(peerDir, '.config_prepared'), '')

      this.log(`密钥分发到 ${peerDir} 完成，分配了 ${nodeSecrets.length} 个密钥`)
      return true
    } catch (error) {
      this.error(`分发密钥失败: ${error}`)
      return false
    }
  }

  // 检查节点健康状态
  protected async checkPeerHealth(port: number, maxRetries: number = 10): Promise<boolean> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const { success, output } = await this.executeCommand(`curl -s "http://localhost:${port}/api/blocks/getstatus"`);
        if (success && output.trim()) {
          this.log(`节点 ${port} 健康检查通过`)
          return true
        }
      } catch (error) {
        // 忽略错误，继续重试
      }

      // 等待一秒后重试
      await this.sleep(1000)
    }

    this.log(`节点 ${port} 健康检查失败`)
    return false
  }
}
