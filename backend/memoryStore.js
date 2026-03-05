const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const MEMORY_FILE = path.join(DATA_DIR, 'safe-memory.json');
const MAX_MEMORY_ITEMS = 24;

const ALLOWED_COLORS = new Set([
  'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'pink', 'black', 'white', 'brown', 'gray', 'grey',
]);
const ALLOWED_TOYS = new Set([
  'car', 'doll', 'ball', 'teddy', 'bear', 'robot', 'blocks', 'puzzle', 'train', 'truck', 'lego', 'kite', 'book',
]);
const ALLOWED_ACTIVITIES = new Set([
  'drawing', 'reading', 'football', 'soccer', 'singing', 'dancing', 'painting', 'running', 'cycling', 'swimming',
  'music', 'games', 'puzzles',
]);

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function defaultMemory() {
  return {
    updatedAt: new Date().toISOString(),
    items: [],
  };
}

function normalizeMemory(input) {
  const base = (input && typeof input === 'object') ? input : {};
  const rawItems = Array.isArray(base.items) ? base.items : [];
  const items = rawItems
    .map((item) => ({
      type: String(item.type || '').trim(),
      value: String(item.value || '').trim().toLowerCase(),
      source: String(item.source || 'chat').trim(),
      updatedAt: String(item.updatedAt || new Date().toISOString()),
    }))
    .filter((item) => item.type && item.value)
    .slice(0, MAX_MEMORY_ITEMS);

  return {
    updatedAt: String(base.updatedAt || new Date().toISOString()),
    items,
  };
}

function readMemory() {
  try {
    if (!fs.existsSync(MEMORY_FILE)) return defaultMemory();
    const raw = fs.readFileSync(MEMORY_FILE, 'utf8');
    if (!raw) return defaultMemory();
    return normalizeMemory(JSON.parse(raw));
  } catch (error) {
    console.error('Failed to read safe memory:', error);
    return defaultMemory();
  }
}

function saveMemory(memoryInput) {
  ensureDataDir();
  const memory = normalizeMemory(memoryInput);
  memory.updatedAt = new Date().toISOString();
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2), 'utf8');
  return memory;
}

function clearMemory() {
  return saveMemory(defaultMemory());
}

function hasSensitiveSignals(text) {
  const lower = String(text || '').toLowerCase();
  if (!lower) return false;
  return (
    /\b\d{3,}\b/.test(lower)
    || /@/.test(lower)
    || /\b(address|street|school|email|phone|whatsapp|telegram)\b/.test(lower)
  );
}

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function extractByPattern(message, pattern, allowedSet) {
  const match = String(message || '').toLowerCase().match(pattern);
  if (!match || !match[1]) return null;
  const candidate = match[1].trim().split(/\s+/)[0];
  return allowedSet.has(candidate) ? candidate : null;
}

function extractCandidates(message) {
  if (hasSensitiveSignals(message)) return [];

  const candidates = [];
  const lower = String(message || '').toLowerCase();
  const words = tokenize(message);

  const explicitColor = extractByPattern(lower, /\b(?:favorite|favourite)\s+color\s+(?:is|=)\s+([a-z]+)/, ALLOWED_COLORS);
  if (explicitColor) candidates.push({ type: 'color', value: explicitColor });

  const explicitToy = extractByPattern(lower, /\b(?:favorite|favourite)\s+toy\s+(?:is|=)\s+([a-z]+)/, ALLOWED_TOYS);
  if (explicitToy) candidates.push({ type: 'toy', value: explicitToy });

  const explicitActivity = extractByPattern(lower, /\b(?:favorite|favourite)\s+(?:activity|sport|hobby)\s+(?:is|=)\s+([a-z]+)/, ALLOWED_ACTIVITIES);
  if (explicitActivity) candidates.push({ type: 'activity', value: explicitActivity });

  if (/\b(i like|i love|i enjoy)\b/.test(lower)) {
    words.forEach((word) => {
      if (ALLOWED_COLORS.has(word)) candidates.push({ type: 'color', value: word });
      if (ALLOWED_TOYS.has(word)) candidates.push({ type: 'toy', value: word });
      if (ALLOWED_ACTIVITIES.has(word)) candidates.push({ type: 'activity', value: word });
    });
  }

  return candidates;
}

function mergeItems(existingItems, additions) {
  const byKey = new Map();
  existingItems.forEach((item) => {
    byKey.set(`${item.type}:${item.value}`, item);
  });

  additions.forEach((item) => {
    const key = `${item.type}:${item.value}`;
    byKey.set(key, {
      type: item.type,
      value: item.value,
      source: 'chat',
      updatedAt: new Date().toISOString(),
    });
  });

  return [...byKey.values()]
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    .slice(0, MAX_MEMORY_ITEMS);
}

function updateMemoryFromMessage(message) {
  const candidates = extractCandidates(message);
  if (!candidates.length) {
    return {
      memory: readMemory(),
      added: [],
    };
  }

  const current = readMemory();
  const nextItems = mergeItems(current.items || [], candidates);
  const memory = saveMemory({
    ...current,
    items: nextItems,
  });

  return {
    memory,
    added: candidates,
  };
}

module.exports = {
  readMemory,
  saveMemory,
  clearMemory,
  updateMemoryFromMessage,
};
