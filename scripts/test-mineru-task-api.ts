import { mineruClient } from '../src/lib/ai/mineru-client';

async function testMineruTaskAPI() {
  const taskId = '31281125-4c08-4e1e-8613-72827b059118';

  console.log('\n===== 测试 MinerU 任务状态接口 =====');
  console.log(`任务ID: ${taskId}`);

  try {
    // 1. 查询任务状态
    console.log('\n1. 查询任务状态: GET /tasks/{taskId}');
    const status = await mineruClient.getTaskStatus(taskId);
    console.log('mineruClient.getTaskStatus()返回:');
    console.log('- status:', status.status);
    console.log('- progress:', status.progress);
    console.log('- error:', status.error);

    // 2. 原始状态API返回
    console.log('\n2. 原始状态API返回:');
    const statusResponse = await fetch(`http://127.0.0.1:8000/tasks/${taskId}`);
    const statusData = await statusResponse.json();
    console.log(JSON.stringify(statusData, null, 2));

    // 3. 获取任务结果
    console.log('\n3. 获取任务结果: GET /tasks/{taskId}/result');
    const resultResponse = await fetch(`http://127.0.0.1:8000/tasks/${taskId}/result`);
    const resultData = await resultResponse.json();
    console.log('结果返回值结构:');
    console.log('顶层字段:', Object.keys(resultData));

    // 如果有results字段，显示详细信息
    if (resultData.results) {
      const results = resultData.results as Record<string, any>;
      const fileNames = Object.keys(results);
      console.log('results包含的文件:', fileNames);

      if (fileNames.length > 0) {
        const firstFile = results[fileNames[0]];
        console.log('第一个文件的字段:', Object.keys(firstFile));
        console.log('md_content长度:', firstFile.md_content?.length || 0);
        console.log('middle_json类型:', typeof firstFile.middle_json);
        console.log('content_list类型:', typeof firstFile.content_list);
        if (firstFile.content_list) {
          const contentList = typeof firstFile.content_list === 'string'
            ? JSON.parse(firstFile.content_list)
            : firstFile.content_list;
          console.log('content_list数量:', contentList?.length || 0);
          if (contentList && contentList.length > 0) {
            console.log('第一个content_list项:', JSON.stringify(contentList[0], null, 2));
          }
        }
      }
    }

    // 4. 使用mineru-client的方法解析结果
    console.log('\n4. 使用 mineruClient.getParseResult() 解析');
    const parsedResult = await mineruClient.getParseResult(taskId);
    console.log('解析结果:');
    console.log('- totalPages:', parsedResult.totalPages);
    console.log('- fullText长度:', parsedResult.fullText.length);
    console.log('- blocks数量:', parsedResult.blocks.length);
    console.log('- tables数量:', parsedResult.tables.length);
    console.log('- status:', parsedResult.status);

    if (parsedResult.blocks.length > 0) {
      console.log('\n第一个block示例:');
      console.log(JSON.stringify(parsedResult.blocks[0], null, 2));
    }

  } catch (error) {
    console.error('\n错误:', error);
  }
}

testMineruTaskAPI();