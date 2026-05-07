import postgres from 'postgres';
import { mineruClient } from '../src/lib/ai/mineru-client';

const sql = postgres('postgresql://postgres:postgres@localhost:5432/smart_tender_review');

async function fixStuckDocuments() {
  console.log('\n===== 修复卡在processing状态的文档 =====');

  // 查找所有processing状态的文档
  const stuckDocs = await sql`SELECT * FROM documents WHERE parse_status = 'processing'`;

  console.log(`发现 ${stuckDocs.length} 个卡住的文档`);

  for (const doc of stuckDocs) {
    console.log(`\n处理文档: ${doc.name}`);
    console.log(`  ID: ${doc.id}`);
    console.log(`  mineruTaskId: ${doc.mineru_task_id}`);

    if (!doc.mineru_task_id) {
      console.log('  ⚠️  无taskId，标记为failed');
      await sql`UPDATE documents SET parse_status = 'failed', parse_error = '提交任务失败，无taskId' WHERE id = ${doc.id}`;
      continue;
    }

    try {
      // 检查MinerU任务实际状态
      console.log(`  检查MinerU任务状态...`);
      const taskStatus = await mineruClient.getTaskStatus(doc.mineru_task_id);
      console.log(`  MinerU状态: ${taskStatus.status}, 进度: ${taskStatus.progress}%`);

      if (taskStatus.status === 'completed') {
        console.log('  ✅ 任务已完成，获取结果并存储');

        // 获取解析结果
        const parseResult = await mineruClient.getParseResult(doc.mineru_task_id);
        console.log(`  结果: ${parseResult.totalPages}页, ${parseResult.blocks.length}区块`);

        // 插入解析结果
        const [parsedResultRecord] = await sql`
          INSERT INTO document_parsed_results (document_id, total_pages, full_text, structured_content, mineru_raw_data)
          VALUES (${doc.id}, ${parseResult.totalPages}, ${parseResult.fullText}, ${parseResult.structured}, ${parseResult.raw})
          RETURNING id
        `;

        console.log(`  插入解析结果ID: ${parsedResultRecord.id}`);

        // 插入blocks（每批100条）
        const blocks = parseResult.blocks;
        for (let i = 0; i < blocks.length; i += 100) {
          const batch = blocks.slice(i, i + 100);
          for (const block of batch) {
            await sql`
              INSERT INTO document_blocks (parsed_result_id, page_number, block_index, block_type, content, bbox)
              VALUES (${parsedResultRecord.id}, ${block.pageNumber}, ${block.index}, ${block.type}, ${block.content}, ${block.bbox || { x0: 0, y0: 0, x1: 0, y1: 0 }})
            `;
          }
          console.log(`  插入blocks批次 ${Math.floor(i / 100) + 1}/${Math.ceil(blocks.length / 100)}`);
        }

        // 更新文档状态
        await sql`
          UPDATE documents
          SET parse_status = 'completed',
              parsed_at = NOW(),
              task_progress = 100,
              updated_at = NOW()
          WHERE id = ${doc.id}
        `;

        console.log('  ✅ 文档状态已更新为completed');
      } else if (taskStatus.status === 'failed') {
        console.log('  ❌ 任务失败，更新状态');
        await sql`
          UPDATE documents
          SET parse_status = 'failed',
              parse_error = ${taskStatus.error || 'MinerU解析失败'},
              updated_at = NOW()
          WHERE id = ${doc.id}
        `;
      } else {
        console.log(`  ⏳ 任务仍在${taskStatus.status}状态，进度: ${taskStatus.progress}%`);
        // 更新进度
        await sql`
          UPDATE documents
          SET task_progress = ${taskStatus.progress || 0},
              updated_at = NOW()
          WHERE id = ${doc.id}
        `;
      }
    } catch (error) {
      console.error('  ❌ 处理失败:', error);
    }
  }

  console.log('\n✅ 所有卡住的文档已处理完成');
  await sql.end();
}

fixStuckDocuments();