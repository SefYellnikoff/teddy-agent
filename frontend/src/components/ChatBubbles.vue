<template>
  <div class="chat-bubbles" ref="chatContainer">
    <div
      v-for="(msg, idx) in history"
      :key="idx"
      class="bubble-wrapper"
      :class="msg.role === 'user' ? 'user-row' : 'teddy-row'"
    >
      <div class="bubble"
        :class="msg.role === 'user' ? 'user-bubble' : 'teddy-bubble'"
      >
        <span v-if="msg.role === 'model'" class="bubble-icon">🧸</span>
        <span class="bubble-text">{{ msg.text }}</span>
      </div>
    </div>
    <div v-if="history.length === 0" class="empty-state">
      <p>👂 Listening...</p>
    </div>
  </div>
</template>

<script setup>
import { watch, ref, nextTick } from 'vue';

const props = defineProps({
  history: {
    type: Array,
    default: () => [],
  },
});

const chatContainer = ref(null);

// Auto-scroll to bottom when new messages arrive
watch(
  () => props.history.length,
  async () => {
    await nextTick();
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
    }
  }
);
</script>

<style scoped>
.chat-bubbles {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.04) 0%, rgba(118, 75, 162, 0.04) 100%);
  border-radius: var(--border-radius);
  border: 1px solid rgba(102, 126, 234, 0.1);
}

.bubble-wrapper {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  animation: fade-in 0.4s ease-out;
}

.user-row {
  justify-content: flex-end;
}

.teddy-row {
  justify-content: flex-start;
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

.bubble {
  max-width: 75%;
  padding: 16px 22px;
  border-radius: 22px;
  line-height: 1.6;
  word-wrap: break-word;
  font-size: 17px;
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.12);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  display: flex;
  align-items: center;
  gap: 10px;
}

.bubble-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.bubble-text {
  flex: 1;
}

.bubble:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.user-bubble {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-bottom-right-radius: 6px;
  font-weight: 600;
  box-shadow: 0 5px 15px rgba(102, 126, 234, 0.35);
  justify-content: flex-end;
}

.teddy-bubble {
  background: linear-gradient(135deg, #fff8e8 0%, #fff0d6 100%);
  color: #2c3e50;
  border-bottom-left-radius: 6px;
  font-weight: 500;
  box-shadow: 0 5px 15px rgba(255, 184, 102, 0.25);
}

@keyframes wobble {
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-3deg); }
  75% { transform: rotate(3deg); }
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #888;
  text-align: center;
  font-size: 19px;
  font-weight: 500;
  text-shadow: none;
}

/* Scrollbar styling */
.chat-bubbles::-webkit-scrollbar {
  width: 8px;
}

.chat-bubbles::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
}

.chat-bubbles::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, rgba(102, 126, 234, 0.4), rgba(118, 75, 162, 0.4));
  border-radius: 10px;
  border: 2px solid rgba(255, 255, 255, 0.05);
}

.chat-bubbles::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, rgba(102, 126, 234, 0.6), rgba(118, 75, 162, 0.6));
}
</style>
