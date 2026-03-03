<template>
  <div class="mic-wrap">
    <div v-if="state === 'listening'" class="bars" aria-hidden="true">
      <span v-for="i in 6" :key="i" class="bar" :style="{ animationDelay: `${i * 0.08}s` }"></span>
    </div>

    <button
      class="mic-btn"
      :class="buttonClass"
      :disabled="disabled"
      @mousedown="handleMouseDown"
      @mouseup="handleMouseUp"
      @mouseleave="handleMouseUp"
      @touchstart="handleMouseDown"
      @touchend="handleMouseUp"
    >
      <span v-if="state === 'idle'" class="icon">🎤</span>
      <span v-else-if="state === 'listening'" class="icon">🎙️</span>
      <span v-else class="icon spinner">⏳</span>
    </button>

    <p class="label">{{ labelText }}</p>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';

const props = defineProps({
  state: {
    type: String,
    default: 'idle',
    validator: (value) => ['idle', 'listening', 'thinking'].includes(value),
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['start-recording', 'stop-recording']);
const isPressed = ref(false);

const buttonClass = computed(() => ({
  idle: props.state === 'idle' && !isPressed.value,
  listening: props.state === 'listening',
  thinking: props.state === 'thinking',
  pressed: isPressed.value,
}));

const labelText = computed(() => {
  if (props.state === 'listening') return 'Listening... release to send';
  if (props.state === 'thinking') return 'Teddy is thinking...';
  return 'Hold to talk';
});

const handleMouseDown = () => {
  if (props.disabled || props.state !== 'idle') return;
  isPressed.value = true;
  emit('start-recording');
};

const handleMouseUp = () => {
  if (!isPressed.value) return;
  isPressed.value = false;
  emit('stop-recording');
};
</script>

<style scoped>
.mic-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.bars {
  height: 30px;
  display: flex;
  align-items: flex-end;
  gap: 5px;
}

.bar {
  width: 5px;
  border-radius: 8px;
  background: linear-gradient(180deg, var(--ui-primary, #d4772a) 0%, var(--ui-primary-dark, #aa551f) 100%);
  height: 10px;
  animation: bar-jump 0.62s ease-in-out infinite;
}

@keyframes bar-jump {
  0%, 100% { height: 8px; }
  45% { height: 28px; }
}

.mic-btn {
  width: 112px;
  height: 112px;
  border-radius: 50%;
  border: 3px solid color-mix(in srgb, var(--ui-primary-soft, #ffeed9) 70%, #ffffff 30%);
  background: linear-gradient(140deg, var(--ui-primary, #d4772a) 0%, var(--ui-primary-dark, #aa551f) 100%);
  color: #fff8f0;
  font-size: 44px;
  display: grid;
  place-items: center;
  cursor: pointer;
  box-shadow: 0 12px 28px rgba(144, 71, 24, 0.34);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.mic-btn.idle:hover:not(:disabled) {
  transform: translateY(-2px);
}

.mic-btn.listening {
  background: linear-gradient(140deg, #eb5a4d 0%, #b5292f 100%);
  box-shadow: 0 12px 32px rgba(184, 49, 55, 0.42);
  animation: ring 1.2s infinite;
}

.mic-btn.thinking {
  background: linear-gradient(140deg, #d9a12f 0%, #a86f18 100%);
}

.mic-btn.pressed {
  transform: scale(0.93);
}

.mic-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.label {
  margin: 0;
  font-size: 13px;
  font-weight: 700;
  color: color-mix(in srgb, var(--ui-text, #402515) 78%, #ffffff 22%);
}

.spinner {
  display: inline-block;
  animation: spin 1.2s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes ring {
  0%, 100% {
    box-shadow: 0 10px 28px rgba(184, 49, 55, 0.36), 0 0 0 0 rgba(213, 75, 62, 0.4);
  }
  50% {
    box-shadow: 0 10px 28px rgba(184, 49, 55, 0.36), 0 0 0 14px rgba(213, 75, 62, 0);
  }
}
</style>
