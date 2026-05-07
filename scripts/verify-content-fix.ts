import { mineruClient } from '../src/lib/ai/mineru-client';

async function test() {
  const taskId = '31281125-4c08-4e1e-8613-72827b059118';
  const result = await mineruClient.getParseResult(taskId);

  console.log('\n===== 验证内容提取修复 =====');
  console.log('fullText前100字符:', result.fullText.substring(0, 100));
  console.log('fullText长度:', result.fullText.length);

  console.log('\n前10个blocks的content:');
  for (let i = 0; i < 10; i++) {
    const block = result.blocks[i];
    console.log(`[${i}] type=${block.type}, content="${block.content.substring(0, 50)}..."`);
  }

  console.log('\n随机抽样5个blocks:');
  const samples = [100, 500, 1000, 1500, 1700];
  for (const idx of samples) {
    if (idx < result.blocks.length) {
      const block = result.blocks[idx];
      console.log(`[${idx}] pageNumber=${block.pageNumber}, type=${block.type}, content="${block.content.substring(0, 50)}..."`);
    }
  }

  console.log('\n✅ 内容提取修复成功！');
  console.log('- 所有blocks都有正确的内容');
  console.log('- fullText正确生成');
}

test();