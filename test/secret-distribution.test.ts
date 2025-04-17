/**
 * 密钥分配算法测试
 * 测试不同场景下的密钥分配是否均匀
 */

// 密钥分配算法
function distributeSecrets(totalSecrets: number, peerCount: number) {
  // 计算基本分配数量和剩余数量
  const baseSecretsPerPeer = Math.floor(totalSecrets / peerCount);
  const remainingSecrets = totalSecrets % peerCount;
  
  const distribution = [];
  
  // 计算每个节点的分配情况
  for (let peerIndex = 1; peerIndex <= peerCount; peerIndex++) {
    // 计算当前节点应该分配的密钥数量
    const currentNodeSecretCount = peerIndex <= remainingSecrets ? baseSecretsPerPeer + 1 : baseSecretsPerPeer;
    
    // 计算当前节点的密钥起始位置
    let startIdx = 0;
    if (peerIndex <= remainingSecrets) {
      // 前 remainingSecrets 个节点，每个节点分配 baseSecretsPerPeer + 1 个密钥
      startIdx = (peerIndex - 1) * (baseSecretsPerPeer + 1);
    } else {
      // 后面的节点，要考虑前面节点多分配的密钥
      startIdx = remainingSecrets * (baseSecretsPerPeer + 1) + (peerIndex - remainingSecrets - 1) * baseSecretsPerPeer;
    }
    
    // 计算结束位置
    const endIdx = startIdx + currentNodeSecretCount;
    
    distribution.push({
      peerIndex,
      startIdx,
      endIdx,
      count: currentNodeSecretCount
    });
  }
  
  return distribution;
}

describe('Secret Distribution Algorithm', () => {
  it('should distribute 24 secrets among 5 peers evenly', () => {
    const distribution = distributeSecrets(24, 5);
    
    // 验证总分配数量
    const totalDistributed = distribution.reduce((sum, item) => sum + item.count, 0);
    expect(totalDistributed).toBe(24);
    
    // 验证分配是否均匀
    expect(distribution[0].count).toBe(5); // 第一个节点
    expect(distribution[1].count).toBe(5); // 第二个节点
    expect(distribution[2].count).toBe(5); // 第三个节点
    expect(distribution[3].count).toBe(5); // 第四个节点
    expect(distribution[4].count).toBe(4); // 第五个节点
    
    // 验证索引是否连续且不重叠
    for (let i = 0; i < distribution.length; i++) {
      const item = distribution[i];
      expect(item.endIdx - item.startIdx).toBe(item.count);
      
      if (i > 0) {
        const prevItem = distribution[i - 1];
        expect(item.startIdx).toBe(prevItem.endIdx);
      }
    }
  });
  
  it('should distribute 101 secrets among 5 peers evenly', () => {
    const distribution = distributeSecrets(101, 5);
    
    // 验证总分配数量
    const totalDistributed = distribution.reduce((sum, item) => sum + item.count, 0);
    expect(totalDistributed).toBe(101);
    
    // 验证分配是否均匀
    expect(distribution[0].count).toBe(21); // 第一个节点
    expect(distribution[1].count).toBe(20); // 第二个节点
    expect(distribution[2].count).toBe(20); // 第三个节点
    expect(distribution[3].count).toBe(20); // 第四个节点
    expect(distribution[4].count).toBe(20); // 第五个节点
    
    // 验证索引是否连续且不重叠
    for (let i = 0; i < distribution.length; i++) {
      const item = distribution[i];
      expect(item.endIdx - item.startIdx).toBe(item.count);
      
      if (i > 0) {
        const prevItem = distribution[i - 1];
        expect(item.startIdx).toBe(prevItem.endIdx);
      }
    }
  });
  
  it('should distribute 10 secrets among 3 peers evenly', () => {
    const distribution = distributeSecrets(10, 3);
    
    // 验证总分配数量
    const totalDistributed = distribution.reduce((sum, item) => sum + item.count, 0);
    expect(totalDistributed).toBe(10);
    
    // 验证分配是否均匀
    expect(distribution[0].count).toBe(4); // 第一个节点
    expect(distribution[1].count).toBe(3); // 第二个节点
    expect(distribution[2].count).toBe(3); // 第三个节点
    
    // 验证索引是否连续且不重叠
    for (let i = 0; i < distribution.length; i++) {
      const item = distribution[i];
      expect(item.endIdx - item.startIdx).toBe(item.count);
      
      if (i > 0) {
        const prevItem = distribution[i - 1];
        expect(item.startIdx).toBe(prevItem.endIdx);
      }
    }
  });
  
  it('should handle edge case with 0 secrets', () => {
    const distribution = distributeSecrets(0, 5);
    
    // 验证总分配数量
    const totalDistributed = distribution.reduce((sum, item) => sum + item.count, 0);
    expect(totalDistributed).toBe(0);
    
    // 验证所有节点分配数量为 0
    distribution.forEach(item => {
      expect(item.count).toBe(0);
    });
  });
  
  it('should handle edge case with 1 peer', () => {
    const distribution = distributeSecrets(10, 1);
    
    // 验证总分配数量
    const totalDistributed = distribution.reduce((sum, item) => sum + item.count, 0);
    expect(totalDistributed).toBe(10);
    
    // 验证唯一节点获得所有密钥
    expect(distribution[0].count).toBe(10);
    expect(distribution[0].startIdx).toBe(0);
    expect(distribution[0].endIdx).toBe(10);
  });
});
