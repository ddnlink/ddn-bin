module.exports = {
  // 指定测试环境
  testEnvironment: 'node',
  
  // 测试文件匹配模式
  testMatch: ['<rootDir>/test/**/*.test.(t|j)s'],
  
  // 转换器配置
  transform: {
    '^.+\\.(t|j)sx?$': 'ts-jest'
  },
  
  // 模块名称映射
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  
  // 覆盖率收集配置
  collectCoverageFrom: [
    'src/**/*.{ts,js}',
    '!src/**/*.d.ts',
    '!**/node_modules/**'
  ],
  
  // 覆盖率报告目录
  coverageDirectory: 'coverage',
  
  // 覆盖率报告格式
  coverageReporters: ['text', 'lcov'],
  
  // 测试超时时间
  testTimeout: 30000,
  
  // 是否显示详细日志
  verbose: true
};
