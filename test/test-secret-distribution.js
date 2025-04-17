// 测试密钥分配算法

function distributeSecrets(totalSecrets, peerCount) {
  // 计算基本分配数量和剩余数量
  const baseSecretsPerPeer = Math.floor(totalSecrets / peerCount);
  const remainingSecrets = totalSecrets % peerCount;
  
  console.log(`总密钥数: ${totalSecrets}, 节点数: ${peerCount}`);
  console.log(`基本分配数量: ${baseSecretsPerPeer}, 剩余数量: ${remainingSecrets}`);
  console.log('-----------------------------------');
  
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
    
    console.log(`节点 ${peerIndex}/${peerCount} 分配密钥范围: ${startIdx}-${endIdx-1}, 共 ${currentNodeSecretCount} 个密钥`);
  }
}

// 测试用例
console.log('测试用例 1: 24 个密钥, 5 个节点');
distributeSecrets(24, 5);

console.log('\n测试用例 2: 101 个密钥, 5 个节点');
distributeSecrets(101, 5);

console.log('\n测试用例 3: 101 个密钥, 3 个节点');
distributeSecrets(101, 3);

console.log('\n测试用例 4: 10 个密钥, 3 个节点');
distributeSecrets(10, 3);

console.log('\n测试用例 5: 10 个密钥, 4 个节点');
distributeSecrets(10, 4);
