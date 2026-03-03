<template>
  <div class="chat-bubbles" ref="chatContainer">
    <div
      v-for="(msg, idx) in history"
      :key="idx"
      class="row"
      :class="msg.role === 'user' ? 'user-row' : 'teddy-row'"
    >
      <div class="bubble" :class="msg.role === 'user' ? 'user-bubble' : 'teddy-bubble'">
        <span v-if="msg.role === 'model'" class="avatar">🧸</span>
        <span>{{ msg.text }}</span>
      </div>
    </div>

    <div v-if="history.length === 0" class="empty-state">
      Start talking to Teddy...
    </div>
  </div>
</template>

<script setup>
import { nextTick, ref, watch } from 'vue';

const props = defineProps({
  history: {
    type: Array,
    default: () => [],
  },
});

const chatContainer = ref(null);

watch(
  () => props.history.length,
  async () => {
    await nextTick();
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
    }
  },
);
</script>

<style scoped>
.chat-bubbles {
  height: 100%;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background:
    radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--ui-primary-soft, #ffeed9) 55%, transparent 45%), transparent 22%),
    var(--ui-chat-surface, #fff9f3);
}

.row {
  display: flex;
}

.user-row {
  justify-content: flex-end;
}

.teddy-row {
  justify-content: flex-start;
}

.bubble {
  max-width: min(78%, 620px);
  padding: 12px 14px;
  border-radius: 16px;
  line-height: 1.45;
  font-size: 16px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  animation: msg-in 0.25s ease-out;
}

.user-bubble {
  background: linear-gradient(135deg, var(--ui-primary, #d4772a) 0%, var(--ui-primary-dark, #aa551f) 100%);
  color: #fff9f4;
  border-bottom-right-radius: 6px;
}

.teddy-bubble {
  background: var(--ui-primary-soft, #ffeed9);
  color: color-mix(in srgb, var(--ui-text, #402515) 82%, #ffffff 18%);
  border: 1px solid color-mix(in srgb, var(--ui-primary, #d4772a) 32%, #ffffff 68%);
  border-bottom-left-radius: 6px;
}

.avatar {
  font-size: 18px;
  line-height: 1;
}

.empty-state {
  margin: auto;
  color: color-mix(in srgb, var(--ui-text, #402515) 70%, #ffffff 30%);
  font-weight: 700;
}

@keyframes msg-in {
  from {
    transform: translateY(6px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.chat-bubbles::-webkit-scrollbar {
  width: 8px;
}

.chat-bubbles::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--ui-primary, #d4772a) 65%, #ffffff 35%);
  border-radius: 999px;
}
</style>
