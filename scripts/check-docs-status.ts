import postgres from 'postgres';

const sql = postgres('postgresql://postgres:postgres@localhost:5432/smart_tender_review');

async function checkDocumentsStatus() {
  console.log('\n===== 检查数据库中所有文档状态 =====');

  const allDocs = await sql`SELECT * FROM documents ORDER BY created_at DESC`;

  console.log('\n文档列表:');
  allDocs.forEach((d, i) => {
    console.log(`[${i}] ${d.name}`);
    console.log(`    parseStatus: ${d.parse_status}`);
    console.log(`    mineruTaskId: ${d.mineru_task_id || '无'}`);
    console.log(`    taskProgress: ${d.task_progress || 0}`);
    console.log(`    parseError: ${d.parse_error || '无'}`);
    console.log('');
  });

  const processingDocs = allDocs.filter(d => d.parse_status === 'processing');
  console.log(`\n发现 ${processingDocs.length} 个processing状态文档`);

  if (processingDocs.length > 0) {
    console.log('\n这些文档可能卡在processing状态，需要检查：');
    processingDocs.forEach(d => {
      console.log(`\n文档ID: ${d.id}`);
      console.log(`  名称: ${d.name}`);
      console.log(`  mineruTaskId: ${d.mineru_task_id}`);

      if (d.mineru_task_id) {
        console.log('  建议: 检查MinerU任务是否真的还在处理');
      } else {
        console.log('  问题: 无taskId，提交可能失败');
      }
    });
  }

  await sql.end();
}

checkDocumentsStatus();