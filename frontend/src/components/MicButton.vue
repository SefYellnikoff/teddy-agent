<template>
  <div class="mic-button-wrapper">
    <button
      class="mic-button"
      :class="buttonClass"
      @mousedown="handleMouseDown"
      @mouseup="handleMouseUp"
      @mouseleave="handleMouseUp"
      @touchstart="handleMouseDown"
      @touchend="handleMouseUp"
      :disabled="disabled"
    >
      <span v-if="state === 'idle'" class="icon">🎤</span>
      <span v-else-if="state === 'listening'" class="icon pulse">🎤</span>
      <span v-else-if="state === 'thinking'" class="icon spinner">⏳</span>
    </button>
    <p class="mic-label">{{ labelText }}</p>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  state: {
    type: String,
    default: 'idle',
    validator: (v) => ['idle', 'listening', 'thinking'].includes(v),
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['start-recording', 'stop-recording']);

const isPressed = ref(false);

const buttonClass = computed(() => {
  return {
    idle: props.state === 'idle' && !isPressed.value,
    listening: props.state === 'listening',
    thinking: props.state === 'thinking',
    pressed: isPressed.value,
  };
});

const labelText = computed(() => {
  switch (props.state) {
    case 'listening':
      return 'Release to send';
    case 'thinking':
      return 'Processing...';
    default:
      return 'Hold to talk';
  }
});

const handleMouseDown = (e) => {
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
.mic-button-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.mic-button {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  border: none;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-size: 54px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 
    0 10px 30px rgba(102, 126, 234, 0.4),
    0 0 0 0 rgba(102, 126, 234, 0.7);
  position: relative;
  overflow: hidden;
}

.mic-button::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0));
  pointer-events: none;
  border-radius: 50%;
}

.mic-button:hover:not(:disabled) {
  transform: scale(1.08);
  box-shadow: 
    0 15px 40px rgba(102, 126, 234, 0.5),
    0 0 0 0 rgba(102, 126, 234, 0.9);
}

.mic-button.listening {
  background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
  box-shadow: 
    0 0 0 0 rgba(255, 107, 107, 0.7),
    0 10px 30px rgba(255, 107, 107, 0.5);
  animation: pulse-ring 1.5s infinite;
}

.mic-button.thinking {
  background: linear-gradient(135deg, #ffa500 0%, #ff8c00 100%);
  animation: spin-smooth 2s linear infinite;
}

.mic-button.pressed {
  background: linear-gradient(135deg, #ff5252 0%, #ff3838 100%);
  transform: scale(0.92);
  box-shadow: 
    0 5px 15px rgba(255, 107, 107, 0.4),
    inset 0 2px 5px rgba(0, 0, 0, 0.2);
}

.mic-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@keyframes pulse-ring {
  0% {
    box-shadow: 
      0 0 0 0 rgba(255, 107, 107, 0.7),
      0 10px 30px rgba(255, 107, 107, 0.5);
  }
  50% {
    box-shadow: 
      0 0 0 15px rgba(255, 107, 107, 0),
      0 10px 30px rgba(255, 107, 107, 0.5);
  }
  100% {
    box-shadow: 
      0 0 0 0 rgba(255, 107, 107, 0),
      0 10px 30px rgba(255, 107, 107, 0.5);
  }
}

@keyframes spin-smooth {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.icon {
  display: block;
  animation: none;
  position: relative;
  z-index: 1;
}

.icon.pulse {
  animation: pulse-icon 1s ease-in-out infinite;
}

.icon.spinner {
  animation: spin-icon 1.5s linear infinite;
}

@keyframes pulse-icon {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.15);
  }
}

@keyframes spin-icon {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.mic-label {
  color: white;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.3px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}
</style>
