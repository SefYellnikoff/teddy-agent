<template>
  <div class="chat-bubbles">
    <div
      v-for="(msg, idx) in history"
      :key="idx"
      class="bubble-wrapper"
      :class="msg.role === 'user' ? 'user-row' : 'teddy-row'"
    >
      <div v-if="msg.role === 'model'" class="teddy-icon">🧸</div>
      <div
        class="bubble"
        :class="msg.role === 'user' ? 'user-bubble' : 'teddy-bubble'"
      >
        {{ msg.text }}
      </div>
    </div>
    <div v-if="history.length === 0" class="empty-state">
      <p>👋 Hello! Press the mic button to start chatting with Teddy!</p>
    </div>
  </div>
</template>

<script setup>
defineProps({
  history: {
    type: Array,
    default: () => [],
  },
});
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
  max-width: 70%;
  padding: 14px 18px;
  border-radius: 20px;
  line-height: 1.5;
  word-wrap: break-word;
  font-size: 15px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
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
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.teddy-bubble {
  background: linear-gradient(135deg, #f5f5f5 0%, #efefef 100%);
  color: #222;
  border-bottom-left-radius: 6px;
  font-weight: 500;
}

.teddy-icon {
  font-size: 32px;
  margin-bottom: 4px;
  animation: wobble 0.6s ease-in-out infinite;
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
  color: #666;
  text-align: center;
  font-size: 17px;
  font-weight: 600;
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
