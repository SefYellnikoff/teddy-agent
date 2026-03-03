<template>
  <div class="page-bg" :class="`theme-${themeMode}`">
    <div v-if="!showDashboard" class="app-shell">
      <header class="top-bar">
        <div class="brand-wrap">
          <div class="brand-icon">🧸</div>
          <div>
            <h1 class="brand-title">Teddy</h1>
            <p class="brand-subtitle">Friendly English buddy</p>
          </div>
        </div>

        <div class="top-right">
          <button class="theme-btn" @click="toggleTheme">
            {{ themeMode === 'warm' ? '🌙 Night' : '☀️ Warm' }}
          </button>
          <div v-if="sessionPhase === 'practicing'" class="stats-pills">
            <span class="stat-pill">⏱ {{ formatTime(sessionStats.duration) }}</span>
            <span class="stat-pill">💬 {{ sessionStats.exchanges }} turns</span>
          </div>
          <button v-if="sessionPhase === 'practicing'" class="end-btn" @click="endSession">End Session</button>
        </div>
      </header>

      <main class="main-grid">
        <section class="teddy-panel">
          <TeddyFace :state="animationState" />
          <div class="teddy-state-chip" :class="animationState">
            {{ teddyStatusText }}
          </div>
        </section>

        <section class="content-panel">
          <div v-if="error" class="error-banner">
            <span>{{ error }}</span>
            <button @click="error = ''" class="error-close">✕</button>
          </div>

          <transition name="panel-switch" mode="out-in">
            <div v-if="sessionPhase === 'idle'" key="idle" class="welcome-panel">
              <p class="kicker">Speak. Learn. Smile.</p>
              <h2>Ready to practice English with Teddy?</h2>
              <p>
                Press start and talk naturally. Teddy listens, responds, and gently helps with grammar.
              </p>
              <button class="start-btn" @click="startSession" :disabled="isLoading">
                <span v-if="!isLoading">🎙 Start Talking</span>
                <span v-else>Loading...</span>
              </button>
            </div>
            <div v-else key="practice" class="practice-panel">
              <div class="chat-frame">
                <ChatBubbles :history="displayHistory" />
              </div>
              <div class="controls-panel">
                <MicButton
                  :state="micState"
                  :disabled="!canTalk"
                  @start-recording="startRecording"
                  @stop-recording="stopRecording"
                />
              </div>
            </div>
          </transition>
        </section>
      </main>
    </div>

    <div v-else class="dashboard-overlay">
      <ParentDashboard
        :session-stats="sessionStats"
        @close="showDashboard = false"
        @new-session="startNewSession"
        @exit="exit"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue';
import TeddyFace from './components/TeddyFace.vue';
import MicButton from './components/MicButton.vue';
import ChatBubbles from './components/ChatBubbles.vue';
import ParentDashboard from './components/ParentDashboard.vue';

const API_URL = 'http://localhost:3000/api/chat';

const history = ref([]);
const sessionPhase = ref('idle');
const animationState = ref('idle');
const showDashboard = ref(false);
const error = ref('');
const selectedTopic = ref(null);
const isLoading = ref(false);
const themeMode = ref(localStorage.getItem('teddy_theme') || 'warm');
const sessionStats = reactive({
  duration: 0,
  exchanges: 0,
  topics: [],
  mistakes: [],
});

let recognition = null;
let synthesis = null;
let sessionStartTime = null;
let updateTimer = null;
let nlpLib = null;
let nlpImportPromise = null;

onMounted(() => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const SpeechSynthesis = window.speechSynthesis;

  if (!SpeechRecognition) {
    error.value = 'Speech Recognition not supported in your browser.';
    return;
  }

  if (!SpeechSynthesis) {
    error.value = 'Speech Synthesis not supported in your browser.';
    return;
  }

  recognition = new SpeechRecognition();
  synthesis = SpeechSynthesis;

  // Keep recognition single-shot to match press-to-talk UX.
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';

  recognition.onstart = () => {
    animationState.value = 'listening';
  };

  recognition.onresult = (event) => {
    let transcript = '';
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      transcript += event.results[i][0].transcript;
    }

    if (transcript.trim()) {
      handleUserMessage(transcript.trim());
    }
  };

  recognition.onerror = (event) => {
    error.value = `Speech recognition error: ${event.error}`;
    animationState.value = 'idle';
  };

  recognition.onend = () => {
    if (animationState.value === 'listening') {
      animationState.value = 'idle';
    }
  };
});

onUnmounted(() => {
  if (updateTimer) clearInterval(updateTimer);
  if (recognition) recognition.stop();
  if (synthesis) synthesis.cancel();
});

const canTalk = computed(() => {
  return animationState.value === 'idle' && sessionPhase.value === 'practicing' && !showDashboard.value;
});

const micState = computed(() => {
  if (animationState.value === 'idle') return 'idle';
  if (animationState.value === 'listening') return 'listening';
  return 'thinking';
});

const displayHistory = computed(() => {
  return history.value.map((item) => ({
    role: item.role,
    text: item.text,
  }));
});

const teddyStatusText = computed(() => {
  if (animationState.value === 'listening') return '👂 Teddy is listening';
  if (animationState.value === 'speaking') return '💬 Teddy is talking';
  if (sessionPhase.value === 'practicing') return '✨ Your turn to speak';
  return '🌟 Ready for a new session';
});

const toggleTheme = () => {
  themeMode.value = themeMode.value === 'warm' ? 'night' : 'warm';
  localStorage.setItem('teddy_theme', themeMode.value);
};

const startSession = async () => {
  selectedTopic.value = null;
  sessionPhase.value = 'practicing';
  animationState.value = 'idle';
  isLoading.value = false;

  sessionStartTime = Date.now();
  updateTimer = setInterval(updateSessionDuration, 1000);

  try {
    animationState.value = 'speaking';
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: '[START_SESSION]',
        history: [],
        topic: null,
        isFirstMessage: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const teddyGreeting = data.reply;

    history.value.push({
      role: 'model',
      parts: [{ text: teddyGreeting }],
      text: teddyGreeting,
    });

    await new Promise((resolve) => {
      speakReply(teddyGreeting, resolve);
    });

    animationState.value = 'idle';
  } catch (err) {
    error.value = `Error: ${err.message}`;
    animationState.value = 'idle';
  }
};

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const detectTopicFromResponse = (userText) => {
  const lowerText = userText.toLowerCase();
  const keywords = {
    'daily-life': ['school', 'home', 'family', 'breakfast', 'lunch', 'dinner', 'morning', 'day', 'routine', 'homework', 'bed', 'friend', 'play'],
    adventure: ['adventure', 'travel', 'trip', 'place', 'go', 'went', 'visit', 'explore', 'mountain', 'beach', 'city'],
    hobbies: ['hobby', 'like', 'enjoy', 'fun', 'play', 'game', 'sport', 'music', 'read', 'draw', 'sing', 'dance'],
  };

  let bestMatch = 'daily-life';
  let maxMatches = 0;

  for (const [topic, words] of Object.entries(keywords)) {
    const matches = words.filter((word) => lowerText.includes(word)).length;
    if (matches > maxMatches) {
      maxMatches = matches;
      bestMatch = topic;
    }
  }

  return bestMatch;
};

const startRecording = () => {
  if (!recognition) return;
  recognition.start();
};

const stopRecording = () => {
  if (!recognition) return;
  recognition.stop();
};

const handleUserMessage = async (userText) => {
  if (!userText.trim()) return;

  if (!selectedTopic.value) {
    selectedTopic.value = detectTopicFromResponse(userText);
  }

  history.value.push({
    role: 'user',
    parts: [{ text: userText }],
    text: userText,
  });

  sessionStats.exchanges += 1;
  animationState.value = 'thinking';

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: userText,
        history: history.value.slice(0, -1),
        topic: selectedTopic.value,
        isFirstMessage: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const teddyReply = data.reply;

    history.value.push({
      role: 'model',
      parts: [{ text: teddyReply }],
      text: teddyReply,
    });

    // Session insights shown in ParentDashboard.
    extractTopics(userText);
    detectMistakes(teddyReply);
    speakReply(teddyReply);
  } catch (err) {
    error.value = `Error: ${err.message}`;
    animationState.value = 'idle';
  }
};

const loadNlp = async () => {
  if (nlpLib) return nlpLib;
  if (!nlpImportPromise) {
    // Lazy-load NLP only when Teddy speaks, to keep initial bundle lighter.
    nlpImportPromise = import('compromise')
      .then((module) => module.default || module)
      .then((loadedNlp) => {
        nlpLib = loadedNlp;
        return loadedNlp;
      });
  }
  return nlpImportPromise;
};

const formatTextForSpeech = async (rawText) => {
  const baseText = String(rawText || '').replace(/\s+/g, ' ').trim();
  if (!baseText) return '';

  const nlp = await loadNlp();
  const doc = nlp(baseText);
  const normalizedText = doc.normalize({
    whitespace: true,
    punctuation: true,
    case: false,
  }).text();

  return normalizedText
    .replace(/([.?!])\s*/g, '$1 ')
    .replace(/\s+(and|but|so|because)\s+/gi, ', $1, ')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

const speakReply = (text, onEnd = null) => {
  if (!synthesis) {
    if (onEnd) onEnd();
    return;
  }

  synthesis.cancel();
  animationState.value = 'speaking';

  formatTextForSpeech(text)
    .catch(() => String(text || ''))
    .then((speechText) => {
      const utterance = new SpeechSynthesisUtterance(speechText || text);
      utterance.rate = 0.9;
      utterance.pitch = 1.2;
      utterance.volume = 1;
      utterance.lang = 'en-US';

      const voices = synthesis.getVoices();
      if (voices.length > 0) {
        let selectedVoice = voices.find((voice) => voice.lang.includes('en-US') && voice.name.includes('Female'));
        if (!selectedVoice) selectedVoice = voices.find((voice) => voice.lang.includes('en-US'));
        if (!selectedVoice) selectedVoice = voices.find((voice) => voice.lang.includes('en'));
        if (!selectedVoice) selectedVoice = voices[0];
        utterance.voice = selectedVoice;
      }

      utterance.onend = () => {
        animationState.value = 'idle';
        if (onEnd) onEnd();
      };

      utterance.onerror = (event) => {
        error.value = `Speech synthesis error: ${event.error}`;
        animationState.value = 'idle';
        if (onEnd) onEnd();
      };

      synthesis.speak(utterance);
    });
};

const extractTopics = (userText) => {
  const words = userText.toLowerCase().split(/\s+/);
  const commonTopics = ['park', 'school', 'game', 'food', 'dog', 'cat', 'friend', 'home', 'play', 'book', 'movie', 'sport'];

  commonTopics.forEach((topic) => {
    if (words.includes(topic) && !sessionStats.topics.includes(topic)) {
      sessionStats.topics.push(topic);
    }
  });
};

const detectMistakes = (teddyReply) => {
  const patterns = [/you\s+(say|said|want)\s+(.+?),?\s+not\s+(.+?)[\.\?!]/gi, /it'?s?\s+(.+?),?\s+not\s+(.+?)[\.\?!]/gi];

  patterns.forEach((pattern) => {
    let match;
    while ((match = pattern.exec(teddyReply)) !== null) {
      const incorrect = match[match.length - 2];
      const correct = match[match.length - 1];
      const mistakeText = `"${incorrect}" → "${correct}"`;

      if (!sessionStats.mistakes.includes(mistakeText)) {
        sessionStats.mistakes.push(mistakeText);
      }
    }
  });
};

const updateSessionDuration = () => {
  if (sessionStartTime && sessionPhase.value === 'practicing') {
    sessionStats.duration = Math.floor((Date.now() - sessionStartTime) / 1000);
  }
};

const endSession = () => {
  if (recognition) recognition.stop();
  if (synthesis) synthesis.cancel();
  animationState.value = 'idle';
  showDashboard.value = true;
};

const startNewSession = () => {
  history.value = [];
  selectedTopic.value = null;
  sessionPhase.value = 'idle';
  animationState.value = 'idle';
  Object.assign(sessionStats, {
    duration: 0,
    exchanges: 0,
    topics: [],
    mistakes: [],
  });
  sessionStartTime = null;
  if (updateTimer) clearInterval(updateTimer);
  showDashboard.value = false;
};

const exit = () => {
  window.location.reload();
};
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;700;800&family=Nunito:wght@500;600;700&display=swap');

.page-bg {
  --ui-page-bg:
    radial-gradient(circle at 20% 20%, rgba(255, 223, 187, 0.6), transparent 35%),
    radial-gradient(circle at 90% 10%, rgba(255, 183, 120, 0.35), transparent 28%),
    linear-gradient(160deg, #fff7ef 0%, #ffeedd 45%, #ffd9b3 100%);
  --ui-text: #402515;
  --ui-shell-bg: rgba(255, 255, 255, 0.78);
  --ui-shell-border: rgba(162, 100, 46, 0.18);
  --ui-shell-shadow: rgba(144, 84, 36, 0.18);
  --ui-topbar-bg: linear-gradient(120deg, #d97a2f 0%, #bc5f20 45%, #8f4317 100%);
  --ui-topbar-text: #fff9f3;
  --ui-accent: #b85f23;
  --ui-accent-strong: #904115;
  --ui-soft-surface: rgba(255, 255, 255, 0.84);
  --ui-soft-border: rgba(157, 91, 43, 0.16);
  --ui-chat-surface: #fffaf4;
  --ui-primary: #d4772a;
  --ui-primary-dark: #aa551f;
  --ui-primary-soft: #ffeed9;
  min-height: 100vh;
  width: 100%;
  padding: 24px;
  background: var(--ui-page-bg);
  display: flex;
  align-items: stretch;
  justify-content: center;
  font-family: 'Nunito', sans-serif;
  color: var(--ui-text);
}

.page-bg.theme-night {
  --ui-page-bg:
    radial-gradient(circle at 12% 18%, rgba(255, 170, 97, 0.16), transparent 28%),
    radial-gradient(circle at 90% 10%, rgba(121, 138, 255, 0.2), transparent 30%),
    linear-gradient(155deg, #171723 0%, #1f1c2f 56%, #2f2338 100%);
  --ui-text: #fce6d5;
  --ui-shell-bg: rgba(27, 23, 35, 0.8);
  --ui-shell-border: rgba(255, 177, 110, 0.18);
  --ui-shell-shadow: rgba(8, 6, 14, 0.5);
  --ui-topbar-bg: linear-gradient(120deg, #7c3f17 0%, #5b2f17 45%, #3a1d17 100%);
  --ui-topbar-text: #ffe8d8;
  --ui-accent: #ffae6a;
  --ui-accent-strong: #f5904f;
  --ui-soft-surface: rgba(42, 34, 48, 0.74);
  --ui-soft-border: rgba(255, 173, 107, 0.2);
  --ui-chat-surface: #352d3e;
  --ui-primary: #e59452;
  --ui-primary-dark: #b9642f;
  --ui-primary-soft: #4a3942;
}

.app-shell {
  width: min(1320px, 100%);
  min-height: calc(100vh - 48px);
  background: var(--ui-shell-bg);
  border: 1px solid var(--ui-shell-border);
  border-radius: 34px;
  backdrop-filter: blur(14px);
  box-shadow: 0 24px 70px var(--ui-shell-shadow);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.top-bar {
  padding: 18px 24px;
  background: var(--ui-topbar-bg);
  color: var(--ui-topbar-text);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.brand-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.2);
  display: grid;
  place-items: center;
  font-size: 23px;
}

.brand-title {
  margin: 0;
  font-family: 'Baloo 2', cursive;
  font-size: 40px;
  line-height: 1;
}

.brand-subtitle {
  margin: 0;
  font-size: 13px;
  opacity: 0.92;
}

.top-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.theme-btn {
  border: 1px solid rgba(255, 255, 255, 0.26);
  background: rgba(255, 255, 255, 0.1);
  color: inherit;
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.02em;
  cursor: pointer;
}

.stats-pills {
  display: flex;
  gap: 8px;
}

.stat-pill {
  background: rgba(255, 255, 255, 0.18);
  padding: 8px 12px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 700;
}

.end-btn {
  border: none;
  border-radius: 999px;
  padding: 10px 15px;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  color: #76310f;
  background: #ffe0c8;
  cursor: pointer;
}

.main-grid {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(330px, 460px) 1fr;
  gap: 18px;
  padding: 18px;
  min-height: 0;
}

.teddy-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
  z-index: 0;
}

.teddy-state-chip {
  border-radius: 14px;
  padding: 12px 14px;
  font-size: 14px;
  font-weight: 700;
  border: 1px solid rgba(167, 95, 41, 0.24);
  background: #fff6ea;
}

.teddy-state-chip.listening {
  background: #fff2da;
  border-color: rgba(231, 139, 44, 0.35);
}

.teddy-state-chip.speaking {
  background: #ffe3d3;
  border-color: rgba(221, 89, 47, 0.4);
}

.content-panel {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  background: var(--ui-soft-surface);
  border: 1px solid var(--ui-soft-border);
  border-radius: 26px;
  padding: 18px;
}

.error-banner {
  border-radius: 12px;
  background: #ffe5e5;
  color: #7b1f1f;
  border: 1px solid #e8b2b2;
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.error-close {
  border: none;
  background: transparent;
  color: #7b1f1f;
  cursor: pointer;
  font-size: 16px;
}

.welcome-panel {
  flex: 1;
  border-radius: 18px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--ui-chat-surface) 84%, #fff 16%) 0%, var(--ui-chat-surface) 100%);
  border: 1px solid var(--ui-soft-border);
  padding: 42px 34px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  gap: 16px;
}

.kicker {
  margin: 0;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-size: 12px;
  font-weight: 800;
  color: #ab5c24;
}

.welcome-panel h2 {
  margin: 0;
  font-family: 'Baloo 2', cursive;
  font-size: clamp(36px, 4.8vw, 62px);
  line-height: 0.95;
  color: var(--ui-accent-strong);
}

.welcome-panel p {
  margin: 0;
  font-size: 19px;
  line-height: 1.55;
  max-width: 620px;
  color: color-mix(in srgb, var(--ui-text) 78%, #ffffff 22%);
}

.start-btn {
  margin-top: 8px;
  border: none;
  border-radius: 999px;
  padding: 18px 42px;
  min-width: 280px;
  font-size: 24px;
  font-weight: 800;
  font-family: 'Baloo 2', cursive;
  color: #fff8f0;
  background: linear-gradient(120deg, var(--ui-primary) 0%, var(--ui-accent) 50%, var(--ui-accent-strong) 100%);
  box-shadow: 0 14px 34px rgba(153, 73, 24, 0.3);
  cursor: pointer;
}

.start-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.practice-panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chat-frame {
  flex: 1;
  min-height: 0;
  border-radius: 18px;
  overflow: hidden;
  border: 1px solid var(--ui-soft-border);
  background: var(--ui-chat-surface);
}

.controls-panel {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 8px 2px;
}

.dashboard-overlay {
  width: 100%;
  min-height: calc(100vh - 48px);
  display: grid;
  place-items: center;
}

.panel-switch-enter-active,
.panel-switch-leave-active {
  transition: opacity 0.24s ease, transform 0.24s ease;
}

.panel-switch-enter-from,
.panel-switch-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

@media (max-width: 1040px) {
  .main-grid {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }
}

@media (max-width: 700px) {
  .page-bg {
    padding: 12px;
  }

  .app-shell {
    min-height: calc(100vh - 24px);
    border-radius: 22px;
  }

  .top-bar {
    padding: 14px;
    flex-wrap: wrap;
  }

  .brand-title {
    font-size: 30px;
  }

  .brand-subtitle {
    display: none;
  }

  .top-right {
    width: 100%;
    justify-content: space-between;
    flex-wrap: wrap;
  }

  .theme-btn {
    order: -1;
  }

  .main-grid {
    padding: 12px;
    gap: 12px;
  }

  .content-panel {
    padding: 12px;
  }

  .welcome-panel {
    padding: 24px 18px;
  }

  .welcome-panel p {
    font-size: 16px;
  }

  .start-btn {
    width: 100%;
    min-width: 0;
    font-size: 22px;
    padding: 14px 22px;
  }
}
</style>
