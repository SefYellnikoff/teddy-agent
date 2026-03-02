<template>
  <div class="parent-dashboard">
    <div class="dashboard-header">
      <h2>📊 Session Report</h2>
      <button class="close-btn" @click="$emit('close')">✕</button>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Session Duration</div>
        <div class="stat-value">{{ formatDuration(sessionStats.duration) }}</div>
      </div>

      <div class="stat-card">
        <div class="stat-label">Exchanges</div>
        <div class="stat-value">{{ sessionStats.exchanges }}</div>
      </div>
    </div>

    <div class="topics-section">
      <h3>💬 Topics Discussed</h3>
      <div v-if="sessionStats.topics.length > 0" class="topics-list">
        <span v-for="(topic, idx) in sessionStats.topics" :key="idx" class="topic-tag">
          {{ topic }}
        </span>
      </div>
      <p v-else class="empty-msg">No topics detected yet.</p>
    </div>

    <div class="mistakes-section">
      <h3>✏️ Grammar Corrections</h3>
      <div v-if="sessionStats.mistakes.length > 0" class="mistakes-list">
        <div v-for="(mistake, idx) in sessionStats.mistakes" :key="idx" class="mistake-item">
          <span class="mistake-text">{{ mistake }}</span>
        </div>
      </div>
      <p v-else class="empty-msg">Great job! No corrections needed. 🎉</p>
    </div>

    <div class="dashboard-footer">
      <button class="btn-primary" @click="handleNewSession">Start New Session</button>
      <button class="btn-secondary" @click="handleExit">Exit</button>
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue';

defineProps({
  sessionStats: {
    type: Object,
    default: () => ({
      duration: 0,
      exchanges: 0,
      topics: [],
      mistakes: [],
    }),
  },
});

const emit = defineEmits(['close', 'new-session', 'exit']);

const formatDuration = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
};

const handleNewSession = () => {
  emit('new-session');
};

const handleExit = () => {
  emit('exit');
};
</script>

<style scoped>
.parent-dashboard {
  background: white;
  border-radius: var(--border-radius);
  padding: 30px;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  border-bottom: 2px solid var(--primary);
  padding-bottom: 15px;
}

.dashboard-header h2 {
  color: var(--primary);
  margin: 0;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: var(--text-light);
  transition: color 0.2s;
}

.close-btn:hover {
  color: var(--text-dark);
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 30px;
}

.stat-card {
  background: linear-gradient(135deg, var(--primary), var(--secondary));
  color: white;
  padding: 20px;
  border-radius: var(--border-radius);
  text-align: center;
}

.stat-label {
  font-size: 12px;
  opacity: 0.9;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.stat-value {
  font-size: 32px;
  font-weight: bold;
}

.topics-section,
.mistakes-section {
  margin-bottom: 30px;
}

.topics-section h3,
.mistakes-section h3 {
  color: var(--primary);
  margin-bottom: 15px;
  font-size: 16px;
}

.topics-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.topic-tag {
  background: var(--user-bubble);
  color: var(--primary);
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
}

.mistakes-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mistake-item {
  background: var(--teddy-bubble);
  padding: 12px;
  border-left: 4px solid var(--accent);
  border-radius: 4px;
  font-size: 13px;
}

.mistake-text {
  color: var(--text-dark);
  line-height: 1.4;
}

.empty-msg {
  color: var(--text-light);
  font-size: 13px;
  font-style: italic;
}

.dashboard-footer {
  display: flex;
  gap: 12px;
  margin-top: 30px;
}

.btn-primary,
.btn-secondary {
  flex: 1;
  padding: 12px 20px;
  border: none;
  border-radius: var(--border-radius);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: linear-gradient(135deg, var(--primary), var(--secondary));
  color: white;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
}

.btn-secondary {
  background: var(--user-bubble);
  color: var(--primary);
  border: 2px solid var(--primary);
}

.btn-secondary:hover {
  background: var(--primary);
  color: white;
}
</style>
