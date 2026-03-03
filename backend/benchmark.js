const { getTeddyReplyDetailed, getActiveModelName } = require('./gemini');

const TEST_CASES = [
  { message: 'this color is blue', topic: 'daily-life' },
  { message: 'i go school every day', topic: 'daily-life' },
  { message: 'i like football and drawing', topic: 'hobbies' },
  { message: 'i went to mountain with my family', topic: 'adventure' },
  { message: 'my favorite food is pizza', topic: 'daily-life' },
];

const SAFE_BENCHMARK_MODELS = ['gemini-2.5-flash', 'gemini-3-flash'];

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function getAvailableModels() {
  return unique([
    getActiveModelName(),
    ...(process.env.GEMINI_FALLBACK_MODELS || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
    ...(process.env.BENCHMARK_MODELS || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
    ...SAFE_BENCHMARK_MODELS,
  ]);
}

function getDefaultModels() {
  if (process.env.BENCHMARK_MODELS) {
    return unique(process.env.BENCHMARK_MODELS
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean));
  }

  return [getActiveModelName()];
}

async function runBenchmark(models = getDefaultModels()) {
  const normalizedModels = models.filter(Boolean);
  const rows = [];

  for (const model of normalizedModels) {
    for (const testCase of TEST_CASES) {
      const result = await getTeddyReplyDetailed({
        message: testCase.message,
        history: [],
        topic: testCase.topic,
        isFirstMessage: false,
        model,
      });

      rows.push({
        model,
        topic: testCase.topic,
        message: testCase.message,
        reply: result.reply,
        latencyMs: result.meta.latencyMs,
        totalTokens: result.meta.usage.totalTokenCount,
        promptTokens: result.meta.usage.promptTokenCount,
        outputTokens: result.meta.usage.candidatesTokenCount,
        replyWords: result.meta.sanitizedWordCount,
        error: result.meta.error || null,
      });
    }
  }

  const summary = [];
  for (const model of normalizedModels) {
    const modelRows = rows.filter((row) => row.model === model);
    const count = modelRows.length || 1;

    summary.push({
      model,
      avgLatencyMs: Math.round(modelRows.reduce((acc, row) => acc + (row.latencyMs || 0), 0) / count),
      avgTotalTokens: Math.round(modelRows.reduce((acc, row) => acc + (row.totalTokens || 0), 0) / count),
      avgReplyWords: Math.round(modelRows.reduce((acc, row) => acc + (row.replyWords || 0), 0) / count),
      errors: modelRows.filter((row) => row.error).length,
      cases: modelRows.length,
    });
  }

  return {
    updatedAt: new Date().toISOString(),
    models: normalizedModels,
    cases: TEST_CASES,
    summary,
    rows,
  };
}

module.exports = {
  TEST_CASES,
  getAvailableModels,
  getDefaultModels,
  runBenchmark,
};
