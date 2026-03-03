<template>
  <div class="teddy-face">
    <div id="lottie-container" class="lottie-container">
      <!-- SVG Mouth Overlay -->
      <svg
        v-if="state === 'speaking'"
        class="mouth"
        viewBox="0 0 100 50"
        xmlns="http://www.w3.org/2000/svg"
      >
        <!-- Open mouth -->
        <ellipse cx="50" cy="35" rx="20" ry="18" fill="#333" />
        <ellipse cx="50" cy="32" rx="20" ry="12" fill="#ff9999" />
      </svg>
    </div>
    <p class="status-text">{{ stateLabel }}</p>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import lottie from 'lottie-web';

const props = defineProps({
  state: {
    type: String,
    default: 'idle',
    validator: (v) => ['idle', 'listening', 'speaking'].includes(v),
  },
});

const stateLabel = ref('');
let animation = null;

onMounted(() => {
  // Load free Lottie animation from CDN
  // Using a simple bear/character animation available on lottiefiles.com
  animation = lottie.loadAnimation({
    container: document.getElementById('lottie-container'),
    renderer: 'svg',
    loop: true,
    autoplay: true,
    path: 'https://assets-v2.lottiefiles.com/a/8fd08c6e-3f38-4104-8c1f-85cb700b5e03/TLjRNGpIkI.json', // Free bear animation
  });
});

watch(
  () => props.state,
  (newState) => {
    if (animation) {
      switch (newState) {
        case 'idle':
          animation.setSpeed(0.5);
          stateLabel.value = '👋 Ready to chat';
          break;
        case 'listening':
          animation.setSpeed(1.5);
          stateLabel.value = '👂 Listening...';
          break;
        case 'speaking':
          animation.setSpeed(2);
          stateLabel.value = '💬 Teddy is speaking...';
          break;
      }
    }
  }
);
</script>

<style scoped>
.teddy-face {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
}

.lottie-container {
  width: 280px;
  height: 280px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.05) 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3px solid rgba(255, 255, 255, 0.2);
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.1),
    inset 0 2px 10px rgba(255, 255, 255, 0.2),
    0 0 40px rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  position: relative;
  animation: gentle-float 3s ease-in-out infinite;
}

.lottie-container::before {
  content: '';
  position: absolute;
  top: -5px;
  left: -5px;
  right: -5px;
  bottom: -5px;
  background: linear-gradient(45deg, #ffd89b, rgba(255, 255, 255, 0));
  border-radius: 50%;
  opacity: 0;
  animation: glow-pulse 2s ease-in-out infinite;
  pointer-events: none;
  z-index: -1;
}

@keyframes gentle-float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
}

@keyframes glow-pulse {
  0%, 100% { opacity: 0; }
  50% { opacity: 0.3; }
}

.status-text {
  font-size: 16px;
  color: #333;
  font-weight: 700;
  text-align: center;
  letter-spacing: 0.5px;
  text-shadow: none;
  animation: fade-in-up 0.5s ease-out;
  background: linear-gradient(135deg, #667eea, #764ba2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.mouth {
  position: absolute;
  width: 60px;
  height: 40px;
  bottom: 50px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  animation: talk 0.4s ease-in-out infinite;
}

@keyframes talk {
  0%, 100% {
    transform: translateX(-50%) scaleY(0.6);
  }
  50% {
    transform: translateX(-50%) scaleY(1);
  }
}
</style>
