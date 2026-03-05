<template>
  <div class="page-bg" :class="`theme-${themeMode}`">
    <div v-if="!showDashboard" class="app-shell">
      <header class="top-bar">
        <div class="brand-wrap">
          <div class="brand-icon">🧸</div>
          <div>
            <h1 class="brand-title">Teddy</h1>
            <p class="brand-subtitle">Natural English companion</p>
          </div>
        </div>

        <div class="top-right">
          <a class="ghost-link" href="http://localhost:3000/ux" target="_blank" rel="noopener noreferrer">UX Metrics</a>
          <button class="theme-btn" @click="toggleTheme">
            {{ themeMode === 'warm' ? 'Night Mode' : 'Warm Mode' }}
          </button>
          <div v-if="sessionPhase === 'practicing'" class="stats-pills">
            <span class="stat-pill">Session {{ formatTime(sessionStats.duration) }}</span>
            <span class="stat-pill">{{ sessionStats.exchanges }} turns</span>
          </div>
          <button v-if="sessionPhase === 'practicing'" class="end-btn" @click="endSession">End</button>
        </div>
      </header>

      <main class="layout">
        <aside class="stage-column">
          <div class="stage-card">
            <TeddyFace :state="animationState" />
          </div>
          <div class="status-row">
            <span class="state-pill" :class="animationState">{{ teddyStatusText }}</span>
          </div>

          <div class="camera-card" :class="{ active: cameraEnabled }">
            <div class="camera-head">
              <strong>Live Vision</strong>
              <button class="tiny-btn" @click="toggleCamera">
                {{ cameraEnabled ? 'Disable' : 'Enable' }}
              </button>
            </div>
            <video
              ref="cameraVideoRef"
              class="camera-preview"
              autoplay
              muted
              playsinline
            ></video>
            <p class="camera-status">{{ cameraStatusText }}</p>
          </div>
        </aside>

        <section class="workspace-column">
          <div v-if="error" class="error-banner">
            <span>{{ error }}</span>
            <button @click="error = ''" class="error-close">✕</button>
          </div>

          <transition name="panel-switch" mode="out-in">
            <section v-if="sessionPhase === 'idle'" key="idle" class="card">
              <div v-if="needsSetup" class="setup-block">
                <p class="kicker">Parent Setup</p>
                <h2>Personalize Teddy</h2>
                <p class="subcopy">Set child profile once, then Teddy will adapt vocabulary and pacing automatically.</p>

                <div class="setup-grid">
                  <label class="field">
                    <span>Child name</span>
                    <input v-model="profileForm.childName" type="text" maxlength="30" placeholder="e.g. Luca" />
                  </label>
                  <label class="field">
                    <span>Age group</span>
                    <select v-model="profileForm.ageGroup">
                      <option value="6-7">6-7 years</option>
                      <option value="8-10">8-10 years</option>
                    </select>
                  </label>
                  <label class="field">
                    <span>English level</span>
                    <select v-model="profileForm.englishLevel">
                      <option value="beginner">Beginner</option>
                      <option value="elementary">Elementary</option>
                    </select>
                  </label>
                  <label class="field">
                    <span>Session minutes</span>
                    <input v-model.number="profileForm.sessionMinutes" type="number" min="5" max="30" step="1" />
                  </label>
                </div>

                <p v-if="setupError" class="setup-error">{{ setupError }}</p>
                <button class="primary-btn" @click="saveParentSetup" :disabled="setupSaving">
                  {{ setupSaving ? 'Saving...' : 'Save Setup' }}
                </button>
              </div>

              <div v-else class="launch-block">
                <p class="kicker">Ready</p>
                <h2>Hello {{ childDisplayName }}, ready to chat with Teddy?</h2>
                <p class="subcopy">Hands-free and camera context are active by default for natural conversation.</p>
                <div class="launch-meta">
                  <span class="chip">Mode: {{ conversationMode === 'handsfree' ? 'Hands-free' : 'Push-to-talk' }}</span>
                  <span class="chip">Memory items: {{ safeMemory.items.length }}</span>
                </div>
                <button class="primary-btn" @click="startSession" :disabled="isLoading">
                  {{ isLoading ? 'Loading...' : 'Start Session' }}
                </button>
              </div>
            </section>

            <section v-else key="practice" class="practice-grid">
              <article class="card chat-card">
                <div class="chat-header">
                  <h3>Conversation</h3>
                  <span class="muted">{{ autoListenPaused ? 'Paused' : 'Live' }}</span>
                </div>
                <div class="chat-frame">
                  <ChatBubbles :history="displayHistory" />
                </div>
              </article>

              <aside class="side-rail">
                <article class="card rail-card">
                  <h4>Conversation Mode</h4>
                  <div class="mode-switch">
                    <button class="mode-btn" :class="{ active: conversationMode === 'handsfree' }" @click="setConversationMode('handsfree')">
                      Hands-free
                    </button>
                    <button class="mode-btn" :class="{ active: conversationMode === 'manual' }" @click="setConversationMode('manual')">
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
                  <div v-else class="actions">
                    <button class="tiny-btn" @click="toggleAutoListen">
                      {{ autoListenPaused ? 'Resume listening' : 'Pause listening' }}
                    </button>
                    <button class="tiny-btn" @click="interruptTeddyAndListen">Interrupt Teddy</button>
                  </div>
                </article>

                <article class="card rail-card">
                  <h4>Live Vision Context</h4>
                  <p class="muted">{{ cameraStatusText }}</p>
                  <div class="tag-list">
                    <span v-for="(item, idx) in visualHighlights" :key="`visual-${idx}`" class="tag">{{ item }}</span>
                    <span v-if="!visualHighlights.length" class="muted">No visual hints yet.</span>
                  </div>
                </article>

                <article class="card rail-card">
                  <div class="memory-head">
                    <h4>Safe Memory</h4>
                    <button class="tiny-btn danger" :disabled="memoryBusy" @click="clearSafeMemory">
                      {{ memoryBusy ? 'Clearing...' : 'Clear' }}
                    </button>
                  </div>
                  <div class="tag-list">
                    <span v-for="(item, idx) in memoryHighlights" :key="`mem-${idx}`" class="tag">{{ item }}</span>
                    <span v-if="!memoryHighlights.length" class="muted">No saved preferences yet.</span>
                  </div>
                </article>
              </aside>
            </section>
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

const visualHighlights = computed(() => {
  const context = latestVisualContext.value || {};
  const objects = Array.isArray(context.objects) ? context.objects : [];
  const colors = Array.isArray(context.colors) ? context.colors : [];
  const list = [];
  if (context.shortScene) list.push(context.shortScene);
  objects.slice(0, 4).forEach((item) => list.push(`object: ${item}`));
  colors.slice(0, 4).forEach((item) => list.push(`color: ${item}`));
  return list.slice(0, 8);
});

const memoryHighlights = computed(() => {
  const items = Array.isArray(safeMemory.value.items) ? safeMemory.value.items : [];
  return items.slice(0, 10).map((item) => `${item.type}: ${item.value}`);
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
  --bg:
    radial-gradient(circle at 14% 12%, rgba(255, 176, 106, 0.46), transparent 35%),
    radial-gradient(circle at 92% 8%, rgba(255, 122, 77, 0.22), transparent 28%),
    linear-gradient(145deg, #fff8ef 0%, #ffe6ce 48%, #ffd2a9 100%);
  --shell: rgba(255, 252, 246, 0.84);
  --shell-border: rgba(164, 101, 50, 0.2);
  --text: #3f2617;
  --muted: #7a5742;
  --accent: #bf6528;
  --accent-2: #8c3f15;
  --surface: rgba(255, 255, 255, 0.74);
  --surface-border: rgba(164, 101, 50, 0.16);
  min-height: 100vh;
  padding: 20px;
  background: var(--bg);
  color: var(--text);
  font-family: 'Nunito', sans-serif;
}

.page-bg.theme-night {
  --bg:
    radial-gradient(circle at 12% 16%, rgba(255, 165, 95, 0.2), transparent 36%),
    radial-gradient(circle at 88% 10%, rgba(127, 143, 255, 0.22), transparent 30%),
    linear-gradient(160deg, #181622 0%, #221d33 52%, #2f2337 100%);
  --shell: rgba(30, 24, 38, 0.84);
  --shell-border: rgba(255, 186, 123, 0.2);
  --text: #ffe9d8;
  --muted: #d2b29b;
  --accent: #ffad6b;
  --accent-2: #f08c4b;
  --surface: rgba(41, 33, 50, 0.72);
  --surface-border: rgba(255, 176, 114, 0.24);
}

.app-shell {
  width: min(1380px, 100%);
  min-height: calc(100vh - 40px);
  margin: 0 auto;
  background: var(--shell);
  border: 1px solid var(--shell-border);
  border-radius: 28px;
  box-shadow: 0 24px 64px rgba(61, 28, 10, 0.18);
  backdrop-filter: blur(14px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.top-bar {
  padding: 16px 22px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  border-bottom: 1px solid var(--surface-border);
}

.brand-wrap {
  display: flex;
  gap: 12px;
  align-items: center;
}

.brand-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  font-size: 24px;
}

.brand-title {
  margin: 0;
  line-height: 1;
  font-size: 40px;
  font-family: 'Baloo 2', cursive;
}

.brand-subtitle {
  margin: 0;
  font-size: 13px;
  color: var(--muted);
}

.top-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.ghost-link,
.theme-btn,
.end-btn {
  border: 1px solid var(--surface-border);
  border-radius: 999px;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 800;
  background: color-mix(in srgb, var(--surface) 88%, #ffffff 12%);
  color: inherit;
  text-decoration: none;
  cursor: pointer;
}

.end-btn {
  background: linear-gradient(120deg, var(--accent) 0%, var(--accent-2) 100%);
  color: #fff7ef;
  border: none;
}

.stats-pills {
  display: flex;
  gap: 8px;
}

.stat-pill {
  border-radius: 999px;
  padding: 7px 11px;
  font-size: 12px;
  font-weight: 700;
  background: color-mix(in srgb, var(--accent) 14%, transparent);
}

.layout {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 360px 1fr;
  gap: 16px;
  padding: 16px;
}

.stage-column {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}

.stage-card,
.camera-card,
.card {
  border-radius: 18px;
  border: 1px solid var(--surface-border);
  background: var(--surface);
}

.stage-card {
  min-height: 320px;
  display: grid;
  place-items: center;
  padding: 8px;
}

.status-row {
  display: flex;
  justify-content: center;
}

.state-pill {
  border-radius: 999px;
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 800;
  background: color-mix(in srgb, var(--accent) 16%, transparent);
}

.camera-card {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.camera-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.camera-preview {
  width: 100%;
  border-radius: 12px;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  background: rgba(20, 18, 18, 0.24);
}

.camera-status {
  margin: 0;
  font-size: 12px;
  color: var(--muted);
}

.workspace-column {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.error-banner {
  border-radius: 12px;
  border: 1px solid #efb9b1;
  background: #ffe4df;
  color: #902d20;
  padding: 10px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  font-weight: 700;
}

.error-close {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
}

.card {
  padding: 22px;
}

.setup-block,
.launch-block {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.kicker {
  margin: 0;
  font-size: 11px;
  letter-spacing: 0.12em;
  font-weight: 800;
  text-transform: uppercase;
  color: var(--accent);
}

h2 {
  margin: 0;
  font-family: 'Baloo 2', cursive;
  font-size: clamp(34px, 3.6vw, 54px);
  line-height: 0.96;
}

.subcopy {
  margin: 0;
  color: var(--muted);
  max-width: 760px;
  line-height: 1.5;
  font-size: 17px;
}

.setup-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-weight: 700;
  font-size: 13px;
}

.field input,
.field select {
  border: 1px solid var(--surface-border);
  border-radius: 11px;
  padding: 11px 12px;
  font-size: 15px;
  font-family: inherit;
  color: inherit;
  background: color-mix(in srgb, var(--surface) 90%, #ffffff 10%);
}

.field input:focus,
.field select:focus {
  outline: 2px solid color-mix(in srgb, var(--accent) 36%, #ffffff 64%);
  outline-offset: 1px;
}

.setup-error {
  margin: 0;
  color: #8f2d1f;
  font-size: 13px;
  font-weight: 700;
}

.primary-btn {
  border: none;
  border-radius: 999px;
  padding: 16px 24px;
  min-width: 220px;
  font-size: 21px;
  font-family: 'Baloo 2', cursive;
  font-weight: 800;
  color: #fff8f2;
  background: linear-gradient(120deg, var(--accent) 0%, var(--accent-2) 100%);
  cursor: pointer;
}

.primary-btn:disabled {
  opacity: 0.66;
  cursor: not-allowed;
}

.launch-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.chip {
  font-size: 12px;
  font-weight: 700;
  border-radius: 999px;
  padding: 6px 10px;
  background: color-mix(in srgb, var(--accent) 14%, transparent);
}

.practice-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 330px;
  gap: 12px;
  min-height: 0;
}

.chat-card {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chat-header h3,
.rail-card h4 {
  margin: 0;
}

.muted {
  color: var(--muted);
  font-size: 12px;
}

.chat-frame {
  flex: 1;
  min-height: 320px;
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid var(--surface-border);
  background: color-mix(in srgb, var(--surface) 84%, #ffffff 16%);
}

.side-rail {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.rail-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.mode-switch {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.mode-btn,
.tiny-btn {
  border: 1px solid var(--surface-border);
  background: color-mix(in srgb, var(--surface) 90%, #ffffff 10%);
  color: inherit;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 800;
  padding: 8px 12px;
  cursor: pointer;
}

.mode-btn.active {
  background: linear-gradient(120deg, var(--accent) 0%, var(--accent-2) 100%);
  border-color: transparent;
  color: #fff9f1;
}

.tiny-btn.danger {
  color: #932f1f;
  border-color: rgba(147, 47, 31, 0.35);
}

.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.manual-controls {
  display: flex;
  justify-content: center;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag {
  padding: 5px 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  background: color-mix(in srgb, var(--accent) 16%, transparent);
}

.memory-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dashboard-overlay {
  width: 100%;
  min-height: calc(100vh - 40px);
  display: grid;
  place-items: center;
}

.panel-switch-enter-active,
.panel-switch-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.panel-switch-enter-from,
.panel-switch-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

@media (max-width: 1180px) {
  .layout {
    grid-template-columns: 1fr;
  }

  .stage-column {
    order: 2;
  }

  .workspace-column {
    order: 1;
  }
}

@media (max-width: 900px) {
  .practice-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 700px) {
  .page-bg {
    padding: 10px;
  }

  .app-shell {
    min-height: calc(100vh - 20px);
    border-radius: 18px;
  }

  .top-bar {
    padding: 12px;
    flex-wrap: wrap;
  }

  .brand-title {
    font-size: 30px;
  }

  .layout {
    padding: 10px;
  }

  .setup-grid {
    grid-template-columns: 1fr;
  }

  .primary-btn {
    width: 100%;
  }
}
</style>
