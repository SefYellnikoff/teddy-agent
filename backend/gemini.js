const { GoogleGenAI } = require('@google/genai');

let client = null;
function getClient() {
  if (client) return client;
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is missing');
  }
  client = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });
  return client;
}

const DEFAULT_MODEL_NAME = 'gemini-2.5-flash';
const ENV_MODEL_NAME = process.env.GEMINI_MODEL;
const ACTIVE_MODEL_NAME = ENV_MODEL_NAME || DEFAULT_MODEL_NAME;
const ENV_FALLBACK_MODELS = (process.env.GEMINI_FALLBACK_MODELS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const SAFE_FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-3-flash'];
const MAX_WORDS = 25;
const FALLBACK_REPLY = "Great try! Can you tell me one more thing?";

const BASE_TEDDY_PROMPT = `You are Teddy, a friendly English tutor for children aged 6-10.
Speak in very simple English (A1-A2 level).
Hard rules:
- Maximum 2 sentences.
- Maximum 25 words total.
- Exactly ONE short question at the end.
- No lists, no bullet points, no long explanations.
- Never explain theory unless the child explicitly asks "why".
- If the child says a correct simple sentence, praise briefly and ask one simple related question.
When the child makes a grammar mistake, correct gently by naturally repeating the correct form.
Never say "wrong", "mistake", or "incorrect".
Keep tone warm, playful, and encouraging.`;

const TOPIC_PROMPTS = {
  'daily-life': `${BASE_TEDDY_PROMPT}
Topic: Daily Life (school, family, meals, routines).`,

  adventure: `${BASE_TEDDY_PROMPT}
Topic: Adventure (places, trips, fun journeys).`,

  hobbies: `${BASE_TEDDY_PROMPT}
Topic: Hobbies (games, sports, music, drawing, reading).`,
};

function extractReplyText(response) {
  if (!response || !Array.isArray(response.candidates) || response.candidates.length === 0) {
    return '';
  }

  const parts = response.candidates[0].content && response.candidates[0].content.parts;
  if (!Array.isArray(parts)) return '';

  return parts.map((part) => part.text || '').join('').trim();
}

function countWords(text) {
  const words = String(text || '').trim().match(/\b[\w']+\b/g);
  return words ? words.length : 0;
}

function applySimpleWordReplacements(text) {
  const replacements = [
    [/\bbecause\b/gi, 'so'],
    [/\btherefore\b/gi, 'so'],
    [/\bhowever\b/gi, 'but'],
    [/\badditionally\b/gi, 'also'],
    [/\bsimilar to\b/gi, 'like'],
    [/\bfor example\b/gi, 'like'],
    [/\bprimarily\b/gi, 'mostly'],
    [/\bapproximately\b/gi, 'about'],
    [/\bexplain\b/gi, 'tell'],
    [/\btheory\b/gi, 'idea'],
  ];

  return replacements.reduce((acc, [pattern, simple]) => acc.replace(pattern, simple), text);
}

function trimToMaxWords(text, maxWords) {
  const words = String(text || '').trim().split(/\s+/);
  if (words.length <= maxWords) return text;
  return `${words.slice(0, maxWords).join(' ').replace(/[,:;]+$/g, '').trim()}.`;
}

function splitIntoSentences(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean);
}

function ensureSingleFinalQuestion(text, questionFallback = 'What do you think?') {
  let clean = String(text || '').trim();
  if (!clean) return questionFallback;

  // Remove all existing question marks to avoid multiple questions.
  clean = clean.replace(/\?/g, '.');
  const sentences = splitIntoSentences(clean);

  const base = sentences.slice(0, 1).join(' ').replace(/[.!?]+$/g, '').trim();
  const question = sentences.length > 1
    ? sentences[sentences.length - 1].replace(/[.!?]+$/g, '').trim()
    : questionFallback;

  const safeBase = base ? `${base}. ` : '';
  const safeQuestion = `${question || questionFallback}?`;
  return `${safeBase}${safeQuestion}`.replace(/\s+/g, ' ').trim();
}

function buildFollowUpQuestion(topic) {
  if (topic === 'adventure') return 'Where do you want to go next?';
  if (topic === 'hobbies') return 'What hobby do you like most?';
  return 'What color do you like best?';
}

function isLikelySimpleChildSentence(message) {
  const msg = String(message || '').trim().toLowerCase();
  if (!msg) return false;
  const words = msg.split(/\s+/);
  if (words.length > 7) return false;
  if (/\b(why|how|explain|because)\b/.test(msg)) return false;
  return /\b(is|are|my|this|that|i|it)\b/.test(msg);
}

function sanitizeForChild(reply, topic, message, isFirstMessage) {
  let output = String(reply || '').replace(/\s+/g, ' ').trim();
  if (!output) return FALLBACK_REPLY;

  // Lightweight post-guardrail to keep output kid-friendly even if model drifts.
  output = applySimpleWordReplacements(output);

  let sentences = splitIntoSentences(output);
  if (sentences.length > 2) {
    output = `${sentences[0]} ${sentences[1]}`;
  }

  if (!isFirstMessage && isLikelySimpleChildSentence(message) && countWords(output) > 18) {
    output = `Nice sentence! ${buildFollowUpQuestion(topic)}`;
  }

  output = trimToMaxWords(output, MAX_WORDS);
  output = ensureSingleFinalQuestion(output, buildFollowUpQuestion(topic));

  if (countWords(output) > MAX_WORDS) {
    output = trimToMaxWords(output, MAX_WORDS);
    output = ensureSingleFinalQuestion(output, buildFollowUpQuestion(topic));
  }

  return output || FALLBACK_REPLY;
}

function previewSanitizedReply(rawReply, topic = 'daily-life', message = '', isFirstMessage = false) {
  const sanitizedReply = sanitizeForChild(rawReply, topic, message, isFirstMessage);
  return {
    rawReply: String(rawReply || ''),
    sanitizedReply,
    rawWordCount: countWords(rawReply),
    sanitizedWordCount: countWords(sanitizedReply),
    topic: topic || 'daily-life',
  };
}

function buildSystemPrompt(topic, isFirstMessage) {
  const topicPrompt = TOPIC_PROMPTS[topic] || TOPIC_PROMPTS['daily-life'];

  if (isFirstMessage) {
    return `${topicPrompt}
This is the first message.
Greet warmly in 1 short sentence, then ask 1 short question.
Do not explain anything yet.`;
  }

  return topicPrompt;
}

function extractUsageMetadata(response) {
  if (!response || typeof response !== 'object') return {};
  const usage = response.usageMetadata || {};
  return {
    promptTokenCount: usage.promptTokenCount ?? null,
    candidatesTokenCount: usage.candidatesTokenCount ?? null,
    totalTokenCount: usage.totalTokenCount ?? null,
  };
}

function buildReplyMeta({ model, startedAt, response, rawReply, sanitizedReply }) {
  return {
    model,
    latencyMs: Date.now() - startedAt,
    rawWordCount: countWords(rawReply),
    sanitizedWordCount: countWords(sanitizedReply),
    usage: extractUsageMetadata(response),
  };
}

function uniqueModels(models) {
  return [...new Set(models.filter(Boolean))];
}

function getCandidateModels(model) {
  return uniqueModels([model, ...ENV_FALLBACK_MODELS, ...SAFE_FALLBACK_MODELS]);
}

function isModelUnavailableError(error) {
  const message = String((error && error.message) || '').toLowerCase();
  return (
    message.includes('no longer available') ||
    message.includes('not found') ||
    message.includes('is not found for api version')
  );
}

/**
 * Send a message to Gemini and get Teddy's reply
 * @param {string} message - The user's message
 * @param {Array<{role: string, parts: Array<{text: string}>}>} history - Conversation history
 * @param {string} topic - The selected topic: daily-life, adventure, hobbies
 * @param {boolean} isFirstMessage - Whether this is the first message to start the session
 * @returns {Promise<string>} - Teddy's reply
 */
async function getTeddyReply(message, history = [], topic = 'daily-life', isFirstMessage = false) {
  const result = await getTeddyReplyDetailed({
    message,
    history,
    topic,
    isFirstMessage,
  });
  return result.reply;
}

/**
 * Detailed variant with diagnostics used by backend logging and benchmarks.
 * @param {{message:string,history:Array,topic?:string,isFirstMessage?:boolean,model?:string}} params
 * @returns {Promise<{reply:string, rawReply:string, meta:object}>}
 */
async function getTeddyReplyDetailed({
  message,
  history = [],
  topic = 'daily-life',
  isFirstMessage = false,
  model = ACTIVE_MODEL_NAME,
}) {
  const startedAt = Date.now();
  const candidateModels = getCandidateModels(model);
  let usedModel = candidateModels[0];
  try {
    const systemPromptText = buildSystemPrompt(topic, isFirstMessage || message === '[START_SESSION]');

    const contents = (isFirstMessage || message === '[START_SESSION]')
      ? [{ role: 'user', parts: [{ text: 'Hello Teddy!' }] }]
      : [
          ...history,
          {
            role: 'user',
            parts: [{ text: message }],
          },
        ];

    let response = null;
    let lastModelError = null;
    for (const currentModel of candidateModels) {
      try {
        usedModel = currentModel;
        response = await getClient().models.generateContent({
          model: currentModel,
          contents,
          systemInstruction: {
            parts: [{ text: systemPromptText }],
          },
        });
        lastModelError = null;
        break;
      } catch (error) {
        lastModelError = error;
        if (isModelUnavailableError(error)) {
          continue;
        }
        throw error;
      }
    }

    if (!response) {
      throw lastModelError || new Error('No Gemini model could generate a response');
    }

    const rawReply = extractReplyText(response);
    const reply = sanitizeForChild(rawReply, topic, message, isFirstMessage);
    return {
      reply,
      rawReply,
      meta: buildReplyMeta({
        model: usedModel,
        startedAt,
        response,
        rawReply,
        sanitizedReply: reply,
      }),
    };
  } catch (error) {
    console.error('Gemini API error:', error);
    return {
      reply: FALLBACK_REPLY,
      rawReply: '',
      meta: {
        model: usedModel,
        latencyMs: Date.now() - startedAt,
        rawWordCount: 0,
        sanitizedWordCount: countWords(FALLBACK_REPLY),
        usage: {},
        error: error.message || 'Gemini API error',
        attemptedModels: candidateModels,
      },
    };
  }
}

function getActiveModelName() {
  return ACTIVE_MODEL_NAME;
}

module.exports = {
  getTeddyReply,
  getTeddyReplyDetailed,
  previewSanitizedReply,
  getActiveModelName,
};
