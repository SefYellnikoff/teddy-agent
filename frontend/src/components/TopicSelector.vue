<template>
  <div class="topic-selector">
    <div class="topic-header">
      <p class="topic-prompt">What would you like to practice today?</p>
    </div>
    
    <div class="topic-buttons">
      <button
        v-for="topic in topics"
        :key="topic.id"
        class="topic-btn"
        :style="`background: linear-gradient(135deg, ${topic.gradientFrom}, ${topic.gradientTo})`"
        @click="selectTopic(topic.id)"
        :disabled="props.disabled"
      >
        <span class="topic-emoji">{{ topic.emoji }}</span>
        <span class="topic-name">{{ topic.name }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
  disabled: Boolean,
});

const emit = defineEmits(['select-topic']);

const topics = ref([
  {
    id: 'daily-life',
    name: 'Daily Life',
    emoji: '🌅',
    gradientFrom: '#667eea',
    gradientTo: '#764ba2',
  },
  {
    id: 'adventure',
    name: 'Adventure',
    emoji: '🗺️',
    gradientFrom: '#f093fb',
    gradientTo: '#f5576c',
  },
  {
    id: 'hobbies',
    name: 'Hobbies',
    emoji: '🎮',
    gradientFrom: '#4facfe',
    gradientTo: '#00f2fe',
  },
]);

const selectTopic = (topicId) => {
  emit('select-topic', topicId);
};
</script>

<style scoped>
.topic-selector {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32px;
  padding: 40px 20px;
  animation: fade-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
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

.topic-header {
  text-align: center;
}

.topic-prompt {
  font-size: 20px;
  font-weight: 700;
  color: #333;
  margin: 0;
  letter-spacing: -0.5px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.topic-buttons {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 20px;
  width: 100%;
  max-width: 500px;
}

.topic-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  border: none;
  border-radius: 16px;
  cursor: pointer;
  font-size: 16px;
  font-weight: 700;
  color: white;
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  gap: 12px;
  min-height: 140px;
  background-size: 200% 200%;
}

.topic-btn:hover:not(:disabled) {
  transform: translateY(-6px);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.2);
}

.topic-btn:active:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
}

.topic-btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.topic-emoji {
  font-size: 40px;
  display: block;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
}

.topic-name {
  font-size: 15px;
  letter-spacing: 0.3px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

@media (max-width: 480px) {
  .topic-buttons {
    grid-template-columns: 1fr;
  }

  .topic-prompt {
    font-size: 18px;
  }
}
</style>
