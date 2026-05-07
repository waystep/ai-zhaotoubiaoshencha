import { mineruClient } from '../src/lib/ai/mineru-client';

async function detailedBlockStructure() {
  const taskId = '31281125-4c08-4e1e-8613-72827b059118';

  const resultResponse = await fetch(`http://127.0.0.1:8000/tasks/${taskId}/result`);
  const resultRaw = await resultResponse.json();

  const results = resultRaw.results as Record<string, any>;
  const firstFileData = results[Object.keys(results)[0]];
  const middleJsonParsed = JSON.parse(firstFileData.middle_json);

  console.log('\n===== pdf_info 第一页的完整结构 =====');
  const firstPage = middleJsonParsed.pdf_info[0];
  console.log('所有字段:', Object.keys(firstPage));

  console.log('\n字段详情:');
  for (const key of Object.keys(firstPage)) {
    const value = firstPage[key];
    console.log(`\n${key}:`);
    console.log('  类型:', typeof value);
    if (Array.isArray(value)) {
      console.log('  数组长度:', value.length);
      if (value.length > 0) {
        console.log('  第一个元素字段:', Object.keys(value[0]));
        console.log('  第一个元素示例:', JSON.stringify(value[0], null, 2).substring(0, 500));
      }
    } else if (typeof value === 'object') {
      console.log('  字段:', Object.keys(value));
    } else {
      console.log('  值:', value);
    }
  }

  console.log('\n===== 统计所有页的blocks数量 =====');
  const stats = {
    preproc_blocks: 0,
    discarded_blocks: 0,
    para_blocks: 0,
    blocks: 0,
  };

  for (const page of middleJsonParsed.pdf_info) {
    stats.preproc_blocks += page.preproc_blocks?.length || 0;
    stats.discarded_blocks += page.discarded_blocks?.length || 0;
    stats.para_blocks += page.para_blocks?.length || 0;
    stats.blocks += page.blocks?.length || 0;
  }

  console.log('统计结果:');
  console.log('- preproc_blocks总数:', stats.preproc_blocks);
  console.log('- discarded_blocks总数:', stats.discarded_blocks);
  console.log('- para_blocks总数:', stats.para_blocks);
  console.log('- blocks总数:', stats.blocks);

  console.log('\n===== mineru-client 实际使用的字段 =====');
  console.log('processPdfInfo代码查找顺序:');
  console.log('pageInfo.blocks || pageInfo.preproc_blocks || pageInfo.blockList || pageInfo.items');
  console.log('\n实际会使用: preproc_blocks (因为blocks不存在)');
  console.log('preproc_blocks总数:', stats.preproc_blocks);

  // 查看 preproc_blocks 的结构
  console.log('\n===== preproc_blocks 内部结构 =====');
  const firstPreprocBlock = firstPage.preproc_blocks[0];
  console.log('第一个preproc_block完整数据:');
  console.log(JSON.stringify(firstPreprocBlock, null, 2));

  // 对比 mineru-client 的处理
  console.log('\n===== mineru-client 处理后的第一个block =====');
  const parsedResult = await mineruClient.getParseResult(taskId);
  const firstProcessedBlock = parsedResult.blocks[0];
  console.log(JSON.stringify(firstProcessedBlock, null, 2));

  console.log('\n===== 字段映射验证 =====');
  console.log('preproc_block → processed_block:');
  console.log('- type:', firstPreprocBlock.type, '→', firstProcessedBlock.type);
  console.log('- text长度:', firstPreprocBlock.text?.length, '→', firstProcessedBlock.content?.length);
  console.log('- bbox:', firstPreprocBlock.bbox, '→', firstProcessedBlock.bbox);
  console.log('- page_idx:', firstPage.page_idx, '→ pageNumber:', firstProcessedBlock.pageNumber);
}

detailedBlockStructure();