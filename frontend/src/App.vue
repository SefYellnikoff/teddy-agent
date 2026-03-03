<template>
  <div class="app-container">
    <!-- Main Chat Interface -->
    <div v-if="!showDashboard" class="chat-interface">
      <!-- Header -->
      <div class="app-header">
        <h1>🧸 Teddy English Tutor</h1>
        <button v-if="sessionPhase === 'practicing'" class="end-session-btn" @click="endSession">
          End Session
        </button>
      </div>

      <!-- Main Content -->
      <div class="main-content">
        <!-- Teddy Face -->
        <div class="teddy-section">
          <TeddyFace :state="animationState" />
        </div>

        <!-- Content Area: depends on phase -->
        <div class="content-area">
          <!-- Idle Phase: Show Start Button -->
          <div v-if="sessionPhase === 'idle'" class="idle-screen">
            <h2>👋 Welcome to Teddy's English Practice!</h2>
            <p>Click the button below to start learning with Teddy.</p>
            <button class="start-btn" @click="startSession" :disabled="isLoading">
              <span v-if="!isLoading">🎉 Start Learning</span>
              <span v-else>Starting...</span>
            </button>
            <button class="test-btn" @click="testSpeech">
              🔊 Test Teddy's Voice
            </button>
          </div>

          <!-- Practicing Phase: Show Chat Bubbles -->
          <ChatBubbles 
            v-else-if="sessionPhase === 'practicing'"
            :history="displayHistory"
          />
        </div>
      </div>

      <!-- Bottom Controls -->
      <div class="controls">
        <!-- Practicing Phase: Show Mic Button -->
        <MicButton 
          v-if="sessionPhase === 'practicing'"
          :state="micState" 
          :disabled="!canTalk" 
          @start-recording="startRecording" 
          @stop-recording="stopRecording" 
        />

        <!-- Error Message -->
        <div v-if="error" class="error-message">
          {{ error }}
          <button @click="error = ''" class="error-close">✕</button>
        </div>
      </div>
    </div>

    <!-- Parent Dashboard -->
    <div v-else class="dashboard-overlay">
      <ParentDashboard :session-stats="sessionStats" @close="showDashboard = false" @new-session="startNewSession" @exit="exit" />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue';
import TeddyFace from './components/TeddyFace.vue';
import MicButton from './components/MicButton.vue';
import ChatBubbles from './components/ChatBubbles.vue';
import ParentDashboard from './components/ParentDashboard.vue';

// API Configuration
const API_URL = 'http://localhost:3000/api/chat';

// State
const history = ref([]);
const sessionPhase = ref('idle'); // idle or practicing
const animationState = ref('idle'); // Animation state: idle, listening, speaking (separate from sessionPhase)
const showDashboard = ref(false);
const error = ref('');
const selectedTopic = ref(null); // Store selected topic: daily-life, adventure, hobbies
const isLoading = ref(false);
const sessionStats = reactive({
  duration: 0,
  exchanges: 0,
  topics: [],
  mistakes: [],
});

// Web Speech API
let recognition = null;
let synthesis = null;
let sessionStartTime = null;
let updateTimer = null;

// Initialize Web Speech API
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

  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';

  recognition.onstart = () => {
    animationState.value = 'listening';
  };

  recognition.onresult = (event) => {
    let transcript = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
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

// Computed
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

// Methods

// Phase 1: User clicks "Start Learning" button → Jump directly to practicing
const startSession = async () => {
  selectedTopic.value = null; // Will be auto-detected from first response
  sessionPhase.value = 'practicing';
  animationState.value = 'idle';
  isLoading.value = false;

  // Initialize session timer
  sessionStartTime = Date.now();
  updateTimer = setInterval(updateSessionDuration, 1000);

  // Fetch Teddy's first greeting from Gemini
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

    // Add Teddy's greeting to history
    history.value.push({
      role: 'model',
      parts: [{ text: teddyGreeting }],
      text: teddyGreeting,
    });

    // Speak the greeting
    await new Promise((resolve) => {
      speakReply(teddyGreeting, resolve);
    });

    animationState.value = 'idle';
  } catch (err) {
    error.value = `Error: ${err.message}`;
    animationState.value = 'idle';
  }
};

// Test button: Play a sample voice line
const testSpeech = async () => {
  console.log('🔊 Testing Teddy voice...');
  const testText = 'Hello! I am Teddy. Can you hear me? This is a test!';
  speakReply(testText);
};

// Helper: Detect topic from user's response
const detectTopicFromResponse = (userText) => {
  const lowerText = userText.toLowerCase();
  const keywords = {
    'daily-life': ['school', 'home', 'family', 'breakfast', 'lunch', 'dinner', 'morning', 'day', 'routine', 'homework', 'bed', 'friend', 'play'],
    'adventure': ['adventure', 'travel', 'trip', 'place', 'go', 'went', 'visit', 'explore', 'mountain', 'beach', 'city'],
    'hobbies': ['hobby', 'like', 'enjoy', 'fun', 'play', 'game', 'sport', 'music', 'read', 'draw', 'sing', 'dance'],
  };

  let bestMatch = 'daily-life';
  let maxMatches = 0;

  for (const [topic, words] of Object.entries(keywords)) {
    const matches = words.filter(w => lowerText.includes(w)).length;
    if (matches > maxMatches) {
      maxMatches = matches;
      bestMatch = topic;
    }
  }

  return bestMatch;
};

// Handle user message during practice
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

  // Auto-detect topic on first user message
  if (!selectedTopic.value) {
    selectedTopic.value = detectTopicFromResponse(userText);
  }

  // Add user message to history
  history.value.push({
    role: 'user',
    parts: [{ text: userText }],
    text: userText,
  });

  sessionStats.exchanges++;
  animationState.value = 'thinking';

  try {
    // Call backend API with topic context
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: userText,
        history: history.value.slice(0, -1), // Exclude current message
        topic: selectedTopic.value,
        isFirstMessage: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const teddyReply = data.reply;

    // Add Teddy's reply to history
    history.value.push({
      role: 'model',
      parts: [{ text: teddyReply }],
      text: teddyReply,
    });

    // Extract topics and detect grammar corrections
    extractTopics(userText);
    detectMistakes(teddyReply, userText);

    // Speak Teddy's reply
    speakReply(teddyReply);
  } catch (err) {
    error.value = `Error: ${err.message}`;
    animationState.value = 'idle';
  }
};

const speakReply = (text, onEnd = null) => {
  if (!synthesis) {
    console.error('Speech Synthesis not available');
    if (onEnd) onEnd();
    return;
  }

  synthesis.cancel();
  animationState.value = 'speaking';

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.9; // Slightly slower for clarity
  utterance.pitch = 1.2; // Higher pitch to sound friendlier
  utterance.volume = 1;
  utterance.lang = 'en-US';

  // Try to find a good English voice, preferably female/child-friendly
  const voices = synthesis.getVoices();
  console.log(`Available voices: ${voices.length}`, voices);
  
  if (voices.length > 0) {
    // Prefer female English voices (usually have "female" or higher naturally in pitch)
    let selectedVoice = voices.find(v => v.lang.includes('en-US') && v.name.includes('Female'));
    if (!selectedVoice) selectedVoice = voices.find(v => v.lang.includes('en-US'));
    if (!selectedVoice) selectedVoice = voices.find(v => v.lang.includes('en'));
    if (!selectedVoice) selectedVoice = voices[0];
    
    utterance.voice = selectedVoice;
    console.log(`Selected voice: ${selectedVoice.name} (${selectedVoice.lang})`);
  }

  utterance.onstart = () => {
    console.log('Speech started:', text.substring(0, 50) + '...');
  };

  utterance.onend = () => {
    console.log('Speech ended');
    animationState.value = 'idle';
    if (onEnd) onEnd();
  };

  utterance.onerror = (event) => {
    console.error('Speech synthesis error:', event.error);
    error.value = `Speech synthesis error: ${event.error}`;
    animationState.value = 'idle';
    if (onEnd) onEnd();
  };

  synthesis.speak(utterance);
  console.log('Speech queued');
};

const extractTopics = (userText) => {
  // Simple topic extraction: look for common nouns and keywords
  const words = userText.toLowerCase().split(/\s+/);
  const commonTopics = ['park', 'school', 'game', 'food', 'dog', 'cat', 'friend', 'home', 'play', 'book', 'movie', 'sport'];

  commonTopics.forEach((topic) => {
    if (words.includes(topic) && !sessionStats.topics.includes(topic)) {
      sessionStats.topics.push(topic);
    }
  });
};

const detectMistakes = (teddyReply, userText) => {
  // Simple mistake detection: look for correction patterns in Teddy's response
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
.app-container {
  width: 100%;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  position: relative;
  overflow: hidden;
}

.app-container::before {
  content: '';
  position: absolute;
  top: -50%;
  right: -50%;
  width: 100%;
  height: 100%;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.1) 0%, transparent 70%);
  pointer-events: none;
}

.chat-interface {
  width: 100%;
  max-width: 900px;
  height: 100%;
  max-height: 900px;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, rgba(250, 250, 250, 0.95) 100%);
  border-radius: 28px;
  box-shadow: 
    0 25px 50px rgba(0, 0, 0, 0.2),
    0 0 1px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  position: relative;
  z-index: 1;
  backdrop-filter: blur(10px);
}

.app-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 24px 28px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.app-header h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.5px;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.end-session-btn {
  background: rgba(255, 255, 255, 0.15);
  color: white;
  border: 2px solid rgba(255, 255, 255, 0.3);
  padding: 10px 20px;
  border-radius: 24px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 700;
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  letter-spacing: 0.3px;
  backdrop-filter: blur(5px);
}

.end-session-btn:hover {
  background: rgba(255, 255, 255, 0.25);
  border-color: white;
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.main-content {
  flex: 1;
  display: flex;
  gap: 24px;
  padding: 24px;
  overflow: hidden;
}

.teddy-section {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 320px;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%);
  border-radius: 24px;
  padding: 20px;
  border: 2px solid rgba(102, 126, 234, 0.1);
}

.content-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow-y: auto;
  padding: 20px;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(248, 248, 255, 0.5) 0%, rgba(240, 240, 255, 0.3) 100%);
}

.idle-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  text-align: center;
  animation: fade-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.idle-screen h2 {
  font-size: 28px;
  font-weight: 700;
  color: #333;
  margin: 0;
  letter-spacing: -0.5px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.idle-screen p {
  font-size: 16px;
  color: #666;
  margin: 0;
  max-width: 300px;
  line-height: 1.5;
}

.start-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  padding: 18px 40px;
  border-radius: 24px;
  font-size: 18px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.3);
  letter-spacing: 0.3px;
  min-width: 200px;
}

.start-btn:hover:not(:disabled) {
  transform: translateY(-4px);
  box-shadow: 0 12px 32px rgba(102, 126, 234, 0.4);
}

.start-btn:active:not(:disabled) {
  transform: translateY(-1px);
}

.start-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.test-btn {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  color: white;
  border: none;
  padding: 12px 28px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  box-shadow: 0 4px 12px rgba(79, 172, 254, 0.3);
  letter-spacing: 0.2px;
}

.test-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(79, 172, 254, 0.4);
}

.test-btn:active {
  transform: translateY(0);
}

@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.controls {
  padding: 24px;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.8) 0%, rgba(248, 248, 252, 0.6) 100%);
  backdrop-filter: blur(10px);
}

.error-message {
  background: linear-gradient(135deg, #ffcdd2 0%, #ffb3ba 100%);
  color: #b71c1c;
  padding: 14px 18px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 4px 12px rgba(179, 28, 28, 0.2);
  border-left: 4px solid #b71c1c;
  animation: slide-in 0.3s ease-out;
}

@keyframes slide-in {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.error-close {
  background: none;
  border: none;
  color: #b71c1c;
  cursor: pointer;
  font-size: 18px;
  padding: 0;
  transition: transform 0.2s;
}

.error-close:hover {
  transform: scale(1.2);
}

.dashboard-overlay {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 1;
}

@media (max-width: 768px) {
  .main-content {
    flex-direction: column;
    padding: 16px;
    gap: 16px;
  }

  .teddy-section {
    min-width: auto;
    min-height: 180px;
  }

  .app-header h1 {
    font-size: 22px;
  }

  .chat-interface {
    border-radius: 20px;
  }
}
</style>
