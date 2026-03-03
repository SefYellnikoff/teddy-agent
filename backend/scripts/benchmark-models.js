require('dotenv').config({ path: `${__dirname}/../.env` });

const { getTeddyReplyDetailed, getActiveModelName } = require('../gemini');

const TEST_CASES = [
  { message: 'this color is blue', topic: 'daily-life' },
  { message: 'i go school every day', topic: 'daily-life' },
  { message: 'i like football and drawing', topic: 'hobbies' },
  { message: 'i went to mountain with my family', topic: 'adventure' },
  { message: 'my favorite food is pizza', topic: 'daily-life' },
];

function parseModelsArg() {
  const args = process.argv.slice(2).filter(Boolean);
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: npm run bench:model -- [model1 model2 ...]');
    console.log('Examples:');
    console.log('  npm run bench:model');
    console.log('  npm run bench:model -- gemini-2.0-flash gemini-3-flash');
    process.exit(0);
  }

  const cliModels = args.filter((value) => !value.startsWith('-'));
  if (cliModels.length > 0) return cliModels;

  const envModels = process.env.BENCHMARK_MODELS;
  if (envModels) {
    return envModels.split(',').map((value) => value.trim()).filter(Boolean);
  }

  return [getActiveModelName()];
}

async function runCase(model, testCase) {
  const result = await getTeddyReplyDetailed({
    message: testCase.message,
    history: [],
    topic: testCase.topic,
    isFirstMessage: false,
    model,
  });

  return {
    model,
    message: testCase.message,
    topic: testCase.topic,
    latencyMs: result.meta.latencyMs,
    totalTokens: result.meta.usage.totalTokenCount,
    replyWords: result.meta.sanitizedWordCount,
    reply: result.reply,
    error: result.meta.error || null,
  };
}

function summarize(rows) {
  const grouped = new Map();
  for (const row of rows) {
    if (!grouped.has(row.model)) grouped.set(row.model, []);
    grouped.get(row.model).push(row);
  }

  for (const [model, modelRows] of grouped.entries()) {
    const avgLatency = Math.round(modelRows.reduce((acc, row) => acc + (row.latencyMs || 0), 0) / modelRows.length);
    const avgTokens = Math.round(modelRows.reduce((acc, row) => acc + (row.totalTokens || 0), 0) / modelRows.length);
    const avgWords = Math.round(modelRows.reduce((acc, row) => acc + (row.replyWords || 0), 0) / modelRows.length);
    const errors = modelRows.filter((row) => row.error).length;

    console.log(`\nModel: ${model}`);
    console.log(`  avg latency: ${avgLatency} ms`);
    console.log(`  avg total tokens: ${avgTokens}`);
    console.log(`  avg reply words: ${avgWords}`);
    console.log(`  errors: ${errors}/${modelRows.length}`);
  }
}

async function main() {
  const models = parseModelsArg();

  if (!process.env.GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY missing in backend/.env');
    process.exit(1);
  }

  console.log('Running benchmark...');
  console.log('Models:', models.join(', '));
  console.log('Cases:', TEST_CASES.length);

  const rows = [];

  for (const model of models) {
    for (const testCase of TEST_CASES) {
      const row = await runCase(model, testCase);
      rows.push(row);
      console.log(`- [${model}] ${testCase.message} -> ${row.latencyMs}ms, ${row.replyWords}w`);
    }
  }

  summarize(rows);

  console.log('\nSample outputs:');
  rows.slice(0, Math.min(rows.length, 8)).forEach((row) => {
    console.log(`- (${row.model}) "${row.message}" => "${row.reply}"`);
  });
}

main().catch((error) => {
  console.error('Benchmark failed:', error);
  process.exit(1);
});
