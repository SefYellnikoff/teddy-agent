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
          <div class="camera-card" :class="{ active: cameraEnabled }">
            <video
              ref="cameraVideoRef"
              class="camera-preview"
              autoplay
              muted
              playsinline
            ></video>
            <div class="camera-meta">
              <strong>Vision</strong>
              <span>{{ cameraStatusText }}</span>
            </div>
          </div>
        </section>

        <section class="content-panel">
          <div v-if="error" class="error-banner">
            <span>{{ error }}</span>
            <button @click="error = ''" class="error-close">✕</button>
          </div>

          <transition name="panel-switch" mode="out-in">
            <div v-if="sessionPhase === 'idle'" key="idle" class="welcome-panel">
              <div v-if="needsSetup" class="setup-panel">
                <p class="kicker">Parent Setup</p>
                <h2>Set up Teddy for your child</h2>
                <p>Save a simple profile so Teddy can greet naturally and adapt language level.</p>

                <div class="setup-grid">
                  <label class="setup-field">
                    <span>Child name</span>
                    <input v-model="profileForm.childName" type="text" maxlength="30" placeholder="e.g. Luca" />
                  </label>

                  <label class="setup-field">
                    <span>Age group</span>
                    <select v-model="profileForm.ageGroup">
                      <option value="6-7">6-7 years</option>
                      <option value="8-10">8-10 years</option>
                    </select>
                  </label>

                  <label class="setup-field">
                    <span>English level</span>
                    <select v-model="profileForm.englishLevel">
                      <option value="beginner">Beginner</option>
                      <option value="elementary">Elementary</option>
                    </select>
                  </label>

                  <label class="setup-field">
                    <span>Session length (minutes)</span>
                    <input v-model.number="profileForm.sessionMinutes" type="number" min="5" max="30" step="1" />
                  </label>
                </div>

                <p v-if="setupError" class="setup-error">{{ setupError }}</p>

                <button class="start-btn" @click="saveParentSetup" :disabled="setupSaving">
                  <span v-if="!setupSaving">Save Setup</span>
                  <span v-else>Saving...</span>
                </button>
              </div>

              <div v-else>
                <p class="kicker">Speak. Learn. Smile.</p>
                <h2>Ready to practice English with Teddy, {{ childDisplayName }}?</h2>
                <p>
                  Press start and talk naturally. Teddy listens, responds, and gently helps with grammar.
                </p>
                <button class="start-btn" @click="startSession" :disabled="isLoading">
                  <span v-if="!isLoading">🎙 Start Talking</span>
                  <span v-else>Loading...</span>
                </button>
              </div>
            </div>
            <div v-else key="practice" class="practice-panel">
              <div class="chat-frame">
                <ChatBubbles :history="displayHistory" />
              </div>
              <div class="controls-panel">
                <div class="mode-switch" role="group" aria-label="Conversation mode">
                  <button
                    class="mode-btn"
                    :class="{ active: conversationMode === 'handsfree' }"
                    @click="setConversationMode('handsfree')"
                  >
                    Hands-free
                  </button>
                  <button
                    class="mode-btn"
                    :class="{ active: conversationMode === 'manual' }"
                    @click="setConversationMode('manual')"
                  >
                    Push-to-talk
                  </button>
                </div>

                <div v-if="conversationMode === 'manual'" class="manual-controls">
                  <MicButton
                    :state="micState"
                    :disabled="!canTalk"
                    @start-recording="startRecording"
                    @stop-recording="stopRecording"
                  />
                </div>

                <div v-else class="handsfree-controls">
                  <button class="hf-btn" @click="toggleAutoListen">
                    {{ autoListenPaused ? 'Resume listening' : 'Pause listening' }}
                  </button>
                  <button class="hf-btn secondary" @click="interruptTeddyAndListen">
                    Interrupt Teddy
                  </button>
                  <button class="hf-btn secondary" @click="toggleCamera">
                    {{ cameraEnabled ? 'Disable camera' : 'Enable camera' }}
                  </button>
                  <span class="hf-status">
                    {{ autoListenPaused ? 'Auto-listening paused' : 'Teddy listens automatically' }}
                  </span>
                </div>
              </div>
            </div>
          </transition>
        </section>
      </main>
    </div>

    <div v-else class="dashboard-overlay">
      <ParentDashboard
        :session-stats="sessionStats"
        :safe-memory="safeMemory"
        :memory-busy="memoryBusy"
        @close="showDashboard = false"
        @new-session="startNewSession"
        @clear-memory="clearSafeMemory"
        @exit="exit"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue';
import Speech from 'speak-tts';
import TeddyFace from './components/TeddyFace.vue';
import MicButton from './components/MicButton.vue';
import ChatBubbles from './components/ChatBubbles.vue';
import ParentDashboard from './components/ParentDashboard.vue';

const API_URL = 'http://localhost:3000/api/chat';
const API_PROFILE_URL = 'http://localhost:3000/api/profile';
const API_VISION_URL = 'http://localhost:3000/api/vision/analyze';
const API_MEMORY_URL = 'http://localhost:3000/api/memory';
const API_UX_EVENT_URL = 'http://localhost:3000/api/ux-event';

const history = ref([]);
const sessionPhase = ref('idle');
const animationState = ref('idle');
const showDashboard = ref(false);
const error = ref('');
const selectedTopic = ref(null);
const isLoading = ref(false);
const themeMode = ref(localStorage.getItem('teddy_theme') || 'warm');
const childProfile = ref(null);
const setupSaving = ref(false);
const setupError = ref('');
const needsSetup = ref(true);
const conversationMode = ref('handsfree');
const autoListenPaused = ref(false);
const isRecognitionActive = ref(false);
const isRequestInFlight = ref(false);
const cameraEnabled = ref(true);
const cameraReady = ref(false);
const cameraError = ref('');
const visionInFlight = ref(false);
const latestVisualContext = ref(null);
const cameraVideoRef = ref(null);
const safeMemory = ref({ items: [], updatedAt: null });
const memoryBusy = ref(false);
const profileForm = reactive({
  childName: '',
  ageGroup: '6-7',
  englishLevel: 'beginner',
  sessionMinutes: 10,
});
const sessionStats = reactive({
  duration: 0,
  exchanges: 0,
  topics: [],
  mistakes: [],
});

let recognition = null;
let synthesis = null;
let tts = null;
let ttsReady = false;
let sessionStartTime = null;
let updateTimer = null;
let nlpLib = null;
let nlpImportPromise = null;
let recognitionRestartTimer = null;
let cameraStream = null;
let visionTimer = null;
let cameraCanvas = null;

onMounted(() => {
  loadProfile().catch((loadError) => {
    console.warn('Profile load failed:', loadError);
  });
  loadMemory().catch((loadError) => {
    console.warn('Safe memory load failed:', loadError);
  });

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
  tts = new Speech();

  // Hands-free uses continuous listen/restart. Manual mode still works with the same recognizer.
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onstart = () => {
    isRecognitionActive.value = true;
    if (animationState.value === 'idle') {
      animationState.value = 'listening';
    }
  };

  recognition.onresult = (event) => {
    let transcript = '';
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      if (result.isFinal) {
        transcript += result[0].transcript;
      }
    }

    if (transcript.trim()) {
      handleUserMessage(transcript.trim());
    }
  };

  recognition.onerror = (event) => {
    if (event.error !== 'no-speech' && event.error !== 'aborted') {
      error.value = `Speech recognition error: ${event.error}`;
    }
    isRecognitionActive.value = false;
    animationState.value = 'idle';
  };

  recognition.onend = () => {
    isRecognitionActive.value = false;
    if (animationState.value === 'listening') {
      animationState.value = 'idle';
    }
    scheduleAutoListening(260);
  };

  if (tts.hasBrowserSupport()) {
    tts.init({
      volume: 1,
      lang: 'en-US',
      rate: 0.92,
      pitch: 1.08,
      splitSentences: false,
    })
      .then(() => {
        const bestVoice = pickBestVoice();
        if (bestVoice && bestVoice.name) {
          tts.setVoice(bestVoice.name);
        }
        ttsReady = true;
      })
      .catch((initError) => {
        console.warn('speak-tts init failed, using native fallback:', initError);
        ttsReady = false;
      });
  }
});

onUnmounted(() => {
  if (updateTimer) clearInterval(updateTimer);
  if (recognitionRestartTimer) clearTimeout(recognitionRestartTimer);
  stopVisionLoop();
  stopCamera();
  if (recognition) recognition.stop();
  stopAllSpeech();
});

const canTalk = computed(() => {
  return conversationMode.value === 'manual'
    && animationState.value === 'idle'
    && sessionPhase.value === 'practicing'
    && !showDashboard.value;
});

const autoListenEnabled = computed(() => {
  return conversationMode.value === 'handsfree'
    && sessionPhase.value === 'practicing'
    && !showDashboard.value
    && !autoListenPaused.value;
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
  if (conversationMode.value === 'handsfree' && autoListenPaused.value && sessionPhase.value === 'practicing') {
    return '⏸ Teddy is paused';
  }
  if (animationState.value === 'listening') return '👂 Teddy is listening';
  if (animationState.value === 'speaking') return '💬 Teddy is talking';
  if (sessionPhase.value === 'practicing') return '✨ Your turn to speak';
  return '🌟 Ready for a new session';
});

const cameraStatusText = computed(() => {
  if (!cameraEnabled.value) return 'Camera off';
  if (cameraError.value) return `Camera error: ${cameraError.value}`;
  if (!cameraReady.value) return 'Camera starting...';
  const context = latestVisualContext.value || {};
  const objects = Array.isArray(context.objects) ? context.objects : [];
  const colors = Array.isArray(context.colors) ? context.colors : [];
  if (!objects.length && !colors.length) return 'Looking for toys and colors...';
  return `I can see ${[...objects, ...colors].slice(0, 3).join(', ')}`;
});

const stopAllSpeech = () => {
  if (tts && ttsReady) {
    try {
      tts.cancel();
    } catch (errorCancel) {
      console.warn('Failed to cancel speak-tts:', errorCancel);
    }
  }
  if (synthesis) synthesis.cancel();
};

const stopVisionLoop = () => {
  if (visionTimer) {
    clearInterval(visionTimer);
    visionTimer = null;
  }
};

const stopCamera = () => {
  if (cameraStream) {
    cameraStream.getTracks().forEach((track) => track.stop());
    cameraStream = null;
  }
  if (cameraVideoRef.value) {
    cameraVideoRef.value.srcObject = null;
  }
  cameraReady.value = false;
};

const startCamera = async () => {
  if (!cameraEnabled.value) return false;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    cameraError.value = 'Camera not supported in this browser.';
    cameraEnabled.value = false;
    return false;
  }
  if (cameraStream && cameraReady.value) return true;

  cameraError.value = '';
  try {
    await nextTick();
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'environment',
        width: { ideal: 640 },
        height: { ideal: 480 },
      },
      audio: false,
    });
    cameraStream = stream;
    if (cameraVideoRef.value) {
      cameraVideoRef.value.srcObject = stream;
      try {
        await cameraVideoRef.value.play();
      } catch (playError) {
        console.warn('Camera preview autoplay blocked:', playError);
      }
    }
    cameraReady.value = true;
    return true;
  } catch (err) {
    cameraError.value = err.message || 'Camera permission denied.';
    cameraEnabled.value = false;
    cameraReady.value = false;
    return false;
  }
};

const captureCameraFrame = () => {
  const videoEl = cameraVideoRef.value;
  if (!videoEl || !cameraReady.value) return null;
  if (!videoEl.videoWidth || !videoEl.videoHeight) return null;

  if (!cameraCanvas) {
    cameraCanvas = document.createElement('canvas');
  }
  const width = Math.min(640, videoEl.videoWidth);
  const height = Math.round((width / videoEl.videoWidth) * videoEl.videoHeight);
  cameraCanvas.width = width;
  cameraCanvas.height = height;

  const ctx = cameraCanvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(videoEl, 0, 0, width, height);
  return cameraCanvas.toDataURL('image/jpeg', 0.58);
};

const analyzeCameraFrame = async () => {
  if (!cameraEnabled.value || !cameraReady.value || visionInFlight.value) return;
  if (sessionPhase.value !== 'practicing') return;

  const imageData = captureCameraFrame();
  if (!imageData) return;

  visionInFlight.value = true;
  try {
    const response = await fetch(API_VISION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageData }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `Vision API error: ${response.status}`);
    }
    latestVisualContext.value = data.context || null;
  } catch (err) {
    cameraError.value = err.message || 'Vision analysis failed.';
  } finally {
    visionInFlight.value = false;
  }
};

const startVisionLoop = async () => {
  stopVisionLoop();
  const ready = await startCamera();
  if (!ready) return;

  analyzeCameraFrame().catch((err) => {
    console.warn('Vision first frame failed:', err);
  });
  visionTimer = setInterval(() => {
    analyzeCameraFrame().catch((err) => {
      console.warn('Vision loop failed:', err);
    });
  }, 12000);
};

const toggleCamera = async () => {
  cameraEnabled.value = !cameraEnabled.value;
  cameraError.value = '';
  sendUxEvent(cameraEnabled.value ? 'camera_enabled' : 'camera_disabled');
  if (!cameraEnabled.value) {
    stopVisionLoop();
    stopCamera();
    latestVisualContext.value = null;
    return;
  }
  if (sessionPhase.value === 'practicing') {
    await startVisionLoop();
  }
};

const scheduleAutoListening = (delayMs = 200) => {
  if (recognitionRestartTimer) {
    clearTimeout(recognitionRestartTimer);
    recognitionRestartTimer = null;
  }
  if (!autoListenEnabled.value) return;
  if (animationState.value !== 'idle') return;
  if (isRequestInFlight.value) return;
  if (isRecognitionActive.value) return;

  recognitionRestartTimer = setTimeout(() => {
    if (!recognition || !autoListenEnabled.value || isRecognitionActive.value) return;
    if (animationState.value !== 'idle') return;
    try {
      recognition.start();
    } catch (errorStart) {
      // Ignore invalid-state races when browser is already starting recognition.
      console.warn('Recognition start skipped:', errorStart);
    }
  }, delayMs);
};

const setConversationMode = (mode) => {
  if (mode !== 'handsfree' && mode !== 'manual') return;
  conversationMode.value = mode;

  if (mode === 'manual') {
    autoListenPaused.value = true;
    stopRecording();
    return;
  }

  autoListenPaused.value = false;
  scheduleAutoListening(80);
};

const toggleAutoListen = () => {
  autoListenPaused.value = !autoListenPaused.value;
  if (autoListenPaused.value) {
    stopRecording();
  } else {
    scheduleAutoListening(80);
  }
};

const interruptTeddyAndListen = () => {
  sendUxEvent('interrupt_teddy');
  stopAllSpeech();
  animationState.value = 'idle';
  autoListenPaused.value = false;
  scheduleAutoListening(60);
};

const childDisplayName = computed(() => {
  return childProfile.value && childProfile.value.childName
    ? childProfile.value.childName
    : 'your child';
});

const applyProfile = (profile) => {
  if (!profile) {
    childProfile.value = null;
    needsSetup.value = true;
    return;
  }

  childProfile.value = profile;
  needsSetup.value = false;
  profileForm.childName = profile.childName || '';
  profileForm.ageGroup = profile.ageGroup || '6-7';
  profileForm.englishLevel = profile.englishLevel || 'beginner';
  profileForm.sessionMinutes = Number(profile.sessionMinutes) || 10;
};

const loadProfile = async () => {
  const response = await fetch(API_PROFILE_URL);
  if (!response.ok) {
    throw new Error(`Profile API error: ${response.status}`);
  }
  const data = await response.json();
  applyProfile(data.profile || null);
};

const normalizeMemoryPayload = (payload) => {
  const base = payload && typeof payload === 'object' ? payload : {};
  const items = Array.isArray(base.items) ? base.items : [];
  return {
    updatedAt: base.updatedAt || null,
    items,
  };
};

const sendUxEvent = async (type) => {
  try {
    await fetch(API_UX_EVENT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    });
  } catch (eventError) {
    // Non-blocking metrics event, safe to ignore if it fails.
    console.warn('UX event failed:', eventError);
  }
};

const loadMemory = async () => {
  const response = await fetch(API_MEMORY_URL);
  if (!response.ok) {
    throw new Error(`Memory API error: ${response.status}`);
  }
  const data = await response.json();
  safeMemory.value = normalizeMemoryPayload(data.memory);
};

const clearSafeMemory = async () => {
  memoryBusy.value = true;
  try {
    const response = await fetch(API_MEMORY_URL, { method: 'DELETE' });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `Memory clear error: ${response.status}`);
    }
    safeMemory.value = normalizeMemoryPayload(data.memory);
  } catch (clearError) {
    error.value = clearError.message || 'Failed to clear memory.';
  } finally {
    memoryBusy.value = false;
  }
};

const saveParentSetup = async () => {
  setupError.value = '';

  if (!profileForm.childName.trim()) {
    setupError.value = 'Please enter your child name.';
    return;
  }

  setupSaving.value = true;
  try {
    const response = await fetch(API_PROFILE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        childName: profileForm.childName.trim(),
        ageGroup: profileForm.ageGroup,
        englishLevel: profileForm.englishLevel,
        sessionMinutes: Number(profileForm.sessionMinutes),
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `Profile save error: ${response.status}`);
    }

    applyProfile(data.profile);
  } catch (saveError) {
    setupError.value = saveError.message || 'Failed to save setup.';
  } finally {
    setupSaving.value = false;
  }
};

const toggleTheme = () => {
  themeMode.value = themeMode.value === 'warm' ? 'night' : 'warm';
  localStorage.setItem('teddy_theme', themeMode.value);
};

const startSession = async () => {
  if (needsSetup.value) {
    error.value = 'Please complete parent setup first.';
    return;
  }

  selectedTopic.value = null;
  sessionPhase.value = 'practicing';
  animationState.value = 'idle';
  isLoading.value = false;
  autoListenPaused.value = conversationMode.value === 'manual';

  sessionStartTime = Date.now();
  sendUxEvent('session_start');
  updateTimer = setInterval(updateSessionDuration, 1000);
  startVisionLoop().catch((visionError) => {
    console.warn('Vision loop start failed:', visionError);
  });

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
        visualContext: latestVisualContext.value,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const teddyGreeting = data.reply;
    if (data.memory) {
      safeMemory.value = normalizeMemoryPayload(data.memory);
    }

    history.value.push({
      role: 'model',
      parts: [{ text: teddyGreeting }],
      text: teddyGreeting,
    });

    await new Promise((resolve) => {
      speakReply(teddyGreeting, resolve);
    });

    animationState.value = 'idle';
    scheduleAutoListening(180);
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
  if (isRecognitionActive.value) return;
  if (recognitionRestartTimer) {
    clearTimeout(recognitionRestartTimer);
    recognitionRestartTimer = null;
  }
  try {
    recognition.start();
  } catch (errorStart) {
    console.warn('Recognition start failed:', errorStart);
  }
};

const stopRecording = () => {
  if (!recognition) return;
  if (recognitionRestartTimer) {
    clearTimeout(recognitionRestartTimer);
    recognitionRestartTimer = null;
  }
  if (!isRecognitionActive.value) return;
  try {
    recognition.stop();
  } catch (errorStop) {
    console.warn('Recognition stop failed:', errorStop);
  }
};

const handleUserMessage = async (userText) => {
  if (!userText.trim()) return;
  if (isRequestInFlight.value) return;

  if (animationState.value === 'speaking') {
    stopAllSpeech();
  }
  stopRecording();

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
  isRequestInFlight.value = true;

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: userText,
        history: history.value.slice(0, -1),
        topic: selectedTopic.value,
        isFirstMessage: false,
        visualContext: latestVisualContext.value,
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const teddyReply = data.reply;
    if (data.memory) {
      safeMemory.value = normalizeMemoryPayload(data.memory);
    }

    history.value.push({
      role: 'model',
      parts: [{ text: teddyReply }],
      text: teddyReply,
    });

    // Session insights shown in ParentDashboard.
    extractTopics(userText);
    detectMistakes(teddyReply);
    await new Promise((resolve) => {
      speakReply(teddyReply, resolve);
    });
    scheduleAutoListening(180);
  } catch (err) {
    error.value = `Error: ${err.message}`;
    animationState.value = 'idle';
    scheduleAutoListening(240);
  } finally {
    isRequestInFlight.value = false;
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

const scoreVoice = (voice = {}) => {
  const name = String(voice.name || '').toLowerCase();
  const lang = String(voice.lang || '').toLowerCase();
  let score = 0;

  if (lang.startsWith('en-us')) score += 6;
  else if (lang.startsWith('en')) score += 4;
  if (voice.localService) score += 2;
  if (name.includes('natural')) score += 4;
  if (name.includes('neural')) score += 3;
  if (name.includes('samantha')) score += 5;
  if (name.includes('aria')) score += 4;
  if (name.includes('google us english')) score += 4;
  if (name.includes('female')) score += 1;

  return score;
};

const pickBestVoice = () => {
  if (!synthesis) return null;
  const voices = synthesis.getVoices() || [];
  if (!voices.length) return null;

  return voices
    .slice()
    .sort((a, b) => scoreVoice(b) - scoreVoice(a))[0];
};

const speakReplyNative = (text, onEnd = null) => {
  if (!synthesis) {
    if (onEnd) onEnd();
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.92;
  utterance.pitch = 1.08;
  utterance.volume = 1;
  utterance.lang = 'en-US';

  const bestVoice = pickBestVoice();
  if (bestVoice) {
    utterance.voice = bestVoice;
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
};

const speakReply = (text, onEnd = null) => {
  if (!synthesis) {
    if (onEnd) onEnd();
    return;
  }

  stopRecording();
  synthesis.cancel();
  animationState.value = 'speaking';

  formatTextForSpeech(text)
    .catch(() => String(text || ''))
    .then((speechText) => {
      const finalText = speechText || String(text || '');
      if (!finalText.trim()) {
        animationState.value = 'idle';
        if (onEnd) onEnd();
        return;
      }

      if (!ttsReady || !tts) {
        speakReplyNative(finalText, onEnd);
        return;
      }

      tts.speak({
        text: finalText,
        queue: false,
        listeners: {
          onend: () => {
            animationState.value = 'idle';
            if (onEnd) onEnd();
          },
          onerror: (speakError) => {
            console.warn('speak-tts failed, fallback to native:', speakError);
            speakReplyNative(finalText, onEnd);
          },
        },
      }).catch((speakError) => {
        console.warn('speak-tts promise failed, fallback to native:', speakError);
        speakReplyNative(finalText, onEnd);
      });
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
  sendUxEvent('session_end');
  autoListenPaused.value = true;
  stopRecording();
  stopAllSpeech();
  stopVisionLoop();
  stopCamera();
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
  autoListenPaused.value = conversationMode.value === 'manual';
  isRequestInFlight.value = false;
  latestVisualContext.value = null;
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

.camera-card {
  width: min(320px, 100%);
  border-radius: 16px;
  border: 1px solid var(--ui-soft-border);
  background: color-mix(in srgb, var(--ui-chat-surface) 84%, #ffffff 16%);
  overflow: hidden;
  opacity: 0.85;
}

.camera-card.active {
  opacity: 1;
}

.camera-preview {
  display: block;
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  background: rgba(20, 20, 22, 0.22);
}

.camera-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 10px;
}

.camera-meta strong {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ui-accent-strong);
}

.camera-meta span {
  font-size: 12px;
  font-weight: 700;
  color: color-mix(in srgb, var(--ui-text) 76%, #ffffff 24%);
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

.setup-panel {
  width: min(760px, 100%);
  display: flex;
  flex-direction: column;
  gap: 14px;
  align-items: center;
}

.setup-grid {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.setup-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  text-align: left;
  font-size: 14px;
  font-weight: 700;
  color: color-mix(in srgb, var(--ui-text) 88%, #ffffff 12%);
}

.setup-field input,
.setup-field select {
  width: 100%;
  border: 1px solid var(--ui-soft-border);
  border-radius: 12px;
  padding: 12px 14px;
  font-size: 16px;
  font-family: inherit;
  background: color-mix(in srgb, var(--ui-chat-surface) 86%, #ffffff 14%);
  color: var(--ui-text);
}

.setup-field input:focus,
.setup-field select:focus {
  outline: 2px solid color-mix(in srgb, var(--ui-primary) 44%, #ffffff 56%);
  outline-offset: 1px;
}

.setup-error {
  margin: 0;
  color: #8a1d1d;
  background: #ffe3df;
  border: 1px solid #efb9b1;
  border-radius: 10px;
  padding: 8px 12px;
  font-size: 14px;
  font-weight: 700;
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
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 10px 8px 2px;
}

.mode-switch {
  display: inline-flex;
  border: 1px solid var(--ui-soft-border);
  border-radius: 999px;
  padding: 4px;
  background: color-mix(in srgb, var(--ui-chat-surface) 88%, #ffffff 12%);
}

.mode-btn {
  border: none;
  background: transparent;
  color: var(--ui-text);
  font-size: 13px;
  font-weight: 800;
  border-radius: 999px;
  padding: 8px 14px;
  cursor: pointer;
}

.mode-btn.active {
  background: linear-gradient(120deg, var(--ui-primary) 0%, var(--ui-accent) 60%, var(--ui-accent-strong) 100%);
  color: #fff8f0;
}

.manual-controls {
  display: flex;
  justify-content: center;
}

.handsfree-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
}

.hf-btn {
  border: 1px solid var(--ui-soft-border);
  background: color-mix(in srgb, var(--ui-chat-surface) 88%, #ffffff 12%);
  color: var(--ui-text);
  border-radius: 999px;
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
}

.hf-btn.secondary {
  background: color-mix(in srgb, var(--ui-primary-soft) 80%, #ffffff 20%);
}

.hf-status {
  font-size: 13px;
  font-weight: 700;
  color: color-mix(in srgb, var(--ui-text) 76%, #ffffff 24%);
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

  .setup-grid {
    grid-template-columns: 1fr;
  }

  .start-btn {
    width: 100%;
    min-width: 0;
    font-size: 22px;
    padding: 14px 22px;
  }

  .handsfree-controls {
    flex-direction: column;
  }
}
</style>
