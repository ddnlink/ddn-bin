// 模拟 @oclif/core 模块
export class Command {
  static flags = {
    help: jest.fn().mockReturnValue({ char: 'h' }),
    boolean: jest.fn().mockImplementation((options) => options),
    integer: jest.fn().mockImplementation((options) => options),
    string: jest.fn().mockImplementation((options) => options)
  }

  log = jest.fn()
  error = jest.fn()
  parse = jest.fn().mockResolvedValue({ flags: {} })

  constructor(argv: string[], config: any) {
    // 空实现
  }
}

export const Flags = {
  boolean: jest.fn().mockImplementation((options) => options),
  integer: jest.fn().mockImplementation((options) => options),
  string: jest.fn().mockImplementation((options) => options),
  help: jest.fn().mockReturnValue({ char: 'h' })
}
