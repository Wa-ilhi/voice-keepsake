<script setup>
import { ref, onMounted, nextTick, computed } from "vue";
import { useRoute } from "vue-router";
import { supabase } from "../lib/supabase";
import QRCode from "qrcode";
import WaveSurfer from "wavesurfer.js";
import bcrypt from "bcryptjs";
import { Swiper, SwiperSlide } from "swiper/vue";
import "swiper/css";

const route = useRoute();
const keepsakes = ref([]);
const keepsake = ref(null);
const wavesurfers = ref({});
const playing = ref({});
const activeMessageId = ref(null);
const swiperRef = ref(null);
const repeatMode = ref(0);
const audioLoaded = ref(false);
const enteredPin = ref("");
const pinError = ref("");
const qrDataUrl = ref("");

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Load keepsake metadata (before PIN)
async function loadKeepsake() {
  const keepsakeId = route.params.id;

  const { data, error } = await supabase
    .from("keepsakes")
    .select("*")
    .eq("id", keepsakeId)
    .single();

  if (error || !data) {
    console.error("Keepsake not found", error);
    pinError.value = "Keepsake not found";
    return;
  }

  keepsake.value = data;

  // Generate QR code for sharing
  qrDataUrl.value = await QRCode.toDataURL(
    `https://voice-keepsake.vercel.app/listen/${keepsakeId}`
  );
}

// Validate PIN and load audio
async function submitPin() {
  pinError.value = "";
  if (!enteredPin.value) {
    pinError.value = "Please enter a PIN";
    return;
  }

  // Compare PIN with hash
  const isValid = await bcrypt.compare(enteredPin.value, keepsake.value.pin_hashed);
  if (!isValid) {
    pinError.value = "Incorrect PIN";
    
    // Shake animation and auto-clear after delay
    setTimeout(() => {
      enteredPin.value = "";
      pinError.value = "";
    }, 800);
    return;
  }

  // PIN is correct, load the audio player
  audioLoaded.value = true;
  await nextTick();
  await loadKeepsakes();
  pinError.value = "";
}

async function loadKeepsakes() {
  const keepsakeId = route.params.id;

  const { data } = await supabase
    .from("keepsakes")
    .select("*")
    .eq("id", keepsakeId);

  if (!data) return;

  // Process keepsakes
  for (let k of data) {
    const { data: signed } = await supabase.storage
      .from("keepsake-audio")
      .createSignedUrl(k.audio_path, 60 * 60);

    k.audioUrl = signed.signedUrl;
    k.qrDataUrl = qrDataUrl.value;
    k.currentTime = "0:00";
    k.duration = "0:00";
    playing.value[k.id] = false;
  }

  keepsakes.value = data;

  // Wait for DOM to fully render
  await nextTick();
  
  // Small delay to ensure Swiper is ready
  setTimeout(() => {
    initializeWaveSurfers();
  }, 100);
}

function initializeWaveSurfers() {
  keepsakes.value.forEach((k) => {
    const container = document.querySelector(`#waveform-${k.id}`);
    
    // Check if container exists before creating WaveSurfer
    if (!container) {
      console.error(`Container #waveform-${k.id} not found`);
      return;
    }

    const ws = WaveSurfer.create({
      container: `#waveform-${k.id}`,
      waveColor: "#525252",
      progressColor: "#1DB954",
      cursorWidth: 0,
      barWidth: 2,
      barGap: 1,
      barRadius: 999,
      height: 48,
      normalize: true,
      interact: true,
    });

    ws.load(k.audioUrl);

    ws.on("ready", () => {
      k.duration = formatTime(ws.getDuration());
    });

    ws.on("audioprocess", () => {
      k.currentTime = formatTime(ws.getCurrentTime());
    });

    ws.on("finish", () => onAudioFinish(k.id));

    wavesurfers.value[k.id] = ws;
  });
}

function toggleRepeat() {
  repeatMode.value = 1 - repeatMode.value;
}

const repeatModeClass = computed(() => {
  return repeatMode.value === 0 ? "text-gray-300" : "text-spotify-green";
});

const repeatModeStyle = computed(() => {
  return repeatMode.value === 0 ? { color: '#f9f9f9' } : { color: '#1DB954' };
});

function onAudioFinish(id) {
  if (repeatMode.value === 1) {
    wavesurfers.value[id]?.play();
  } else {
    playing.value[id] = false;
  }
}

function toggleAudio(id) {
  const ws = wavesurfers.value[id];
  if (!ws) return;
  ws.playPause();
  playing.value[id] = !playing.value[id];
}

function openMessage(k) {
  activeMessageId.value = k.id;
}

function closeMessage() {
  activeMessageId.value = null;
}

function addDigit(num) {
  if (enteredPin.value.length < 4) {
    enteredPin.value += num.toString();
    // Auto-submit when 4 digits are entered (optional)
    if (enteredPin.value.length === 4) {
      setTimeout(() => submitPin(), 300);
    }
  }
}

function deleteDigit() {
  enteredPin.value = enteredPin.value.slice(0, -1);
  pinError.value = "";
}

function clearPin() {
  enteredPin.value = "";
  pinError.value = "";
}

onMounted(loadKeepsake);
</script>

<template>
  <div
    class="min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-rose-100 flex items-center justify-center px-4 py-6"
  >
<!-- PIN Lock Screen (before unlock) - Cyberpunk Theme - Mobile Vertical -->
<div 
  v-if="!audioLoaded" 
  class="cyberpunk-card bg-black/95 backdrop-blur-lg rounded-3xl shadow-2xl w-full max-w-sm p-6 sm:p-8 text-center relative overflow-hidden"
>
  <!-- Glowing border effect -->
  <div class="absolute inset-0 rounded-3xl bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 opacity-20 blur-xl"></div>
  <div class="absolute inset-[2px] rounded-3xl bg-black"></div>
  
  <!-- Content -->
  <div class="relative z-10">
    <!-- Glitch effect title -->
   <div class="relative z-10">
  <!-- Circular Logo -->
  <div class="logo-border mx-auto mb-3">
     <video 
    src="/src/assets/hero_dgk.mp4" 
    autoplay 
    loop 
    muted 
    playsinline
    class="logo-video"
  ></video>
  </div>  

</div>

    
   

    <!-- PIN Display -->
<div class="mb-6 w-full">
  <div class="pin-display-container">
    <div 
      v-for="i in 4" 
      :key="i"
      class="pin-box"
      :class="{
        'filled': !pinError && enteredPin.length >= i,
        'error': pinError
      }"
    >
      <!-- Empty state - hollow circle -->
      <ion-icon 
        v-if="enteredPin.length < i" 
        name="ellipse-outline"
        :class="pinError ? 'text-red-400/50' : 'text-cyan-700/30'"
        class="text-2xl"
      ></ion-icon>
      <!-- Filled state - filled circle -->
      <ion-icon 
        v-else
        name="ellipse"
        :class="pinError ? 'text-red-400' : 'text-cyan-400'"
        class="text-2xl"
      ></ion-icon>
    </div>
  </div>
  <p class="text-cyan-500/60 text-[10px] font-mono tracking-widest text-center">Please enter your 4-digit code</p>
</div>

<!-- Remove the error message paragraph -->
<!-- <p v-if="pinError" class="text-red-500 mt-3 font-mono text-xs animate-pulse px-2">
  ⚠ {{ pinError }} ⚠
</p> -->

    <!-- Number Keypad - Vertical Grid -->
   <!-- Number Keypad - iOS Style with CSS -->
<div class="ios-keypad-container">
  <!-- Row 1: 1 2 3 -->
  <div class="ios-keypad-row">
    <button
      v-for="num in [1, 2, 3]"
      :key="num"
      @click="addDigit(num)"
      class="ios-keypad-button"
    >
      {{ num }}
    </button>
  </div>

  <!-- Row 2: 4 5 6 -->
  <div class="ios-keypad-row">
    <button
      v-for="num in [4, 5, 6]"
      :key="num"
      @click="addDigit(num)"
      class="ios-keypad-button"
    >
      {{ num }}
    </button>
  </div>

  <!-- Row 3: 7 8 9 -->
  <div class="ios-keypad-row">
    <button
      v-for="num in [7, 8, 9]"
      :key="num"
      @click="addDigit(num)"
      class="ios-keypad-button"
    >
      {{ num }}
    </button>
  </div>

  <!-- Row 4: Clear 0 Backspace -->
        <div class="ios-keypad-row">
        <!-- Clear Button -->
        <button @click="clearPin" class="ios-keypad-clear">
          <ion-icon name="close-circle-outline" class="text-2xl"></ion-icon>
        </button>
        
        <!-- Zero Button -->
        <button @click="addDigit(0)" class="ios-keypad-button">
          0
        </button>
        
        <!-- Backspace Button -->
        <button @click="deleteDigit" class="ios-keypad-backspace">
          <ion-icon name="backspace-outline" class="text-2xl"></ion-icon>
        </button>
      </div>
      </div>

    
    
 

  </div>
</div>

    <!-- Main Player (after unlock) -->
    <Swiper
      v-else
      ref="swiperRef"
      :slides-per-view="1"
      class="w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-4xl"
    >
      <SwiperSlide v-for="k in keepsakes" :key="k.id">
        <div class="spotify-card relative">
          <!-- Desktop: Left side - Album Art -->
          <div class="album-section">
            <!-- Header -->
            <div class="header mb-2 text-sm sm:text-base text-gray-200">
              Voice Keepsake
            </div>

            <!-- Album Art -->
            <img
              :src="k.qrDataUrl"
              class="album-art w-40 h-40 sm:w-48 sm:h-48 md:w-56 md:h-56 lg:w-60 lg:h-60 object-cover rounded-full mb-4"
              :class="{ spinning: playing[k.id] }"
              alt="Keepsake QR Code"
            />
          </div>

          <!-- Desktop: Right side - Controls -->
          <div class="controls-section">
            <!-- Song Info -->
            <div class="text-center lg:text-left mb-4">
              <h2 class="text-lg sm:text-xl md:text-2xl font-semibold text-white">
                {{ k.title }}
              </h2>
            </div>

            <!-- Waveform -->
            <div
              :id="`waveform-${k.id}`"
              class="w-full h-12 sm:h-14 md:h-16 rounded-full bg-gray-200 overflow-hidden px-2 hover:bg-gray-300 transition cursor-pointer mb-4"
            ></div>

            <!-- Time -->
            <div
              class="time w-full flex justify-between text-xs sm:text-sm text-gray-300 mb-4 px-2"
            >
              <span>{{ k.currentTime }}</span>
              <span>{{ k.duration }}</span>
            </div>

            <!-- Controls -->
            <div
              class="controls flex items-center justify-around w-full px-6 mb-4"
            >
              <!-- Info / Message -->
              <button
                @click="openMessage(k)"
                class="icon w-9 h-9 sm:w-11 sm:h-11 text-white hover:text-gray-300"
              >
                <ion-icon
                  name="mail-unread-outline"
                  class="w-full h-full"
                ></ion-icon>
              </button>

              <!-- Play / Pause -->
              <button
                @click="toggleAudio(k.id)"
                class="play w-10 h-10 sm:w-12 sm:h-12 text-white hover:text-gray-300"
              >
                <ion-icon
                  v-if="playing[k.id]"
                  name="pause-circle"
                  class="w-full h-full"
                ></ion-icon>
                <ion-icon
                  v-else
                  name="play-circle"
                  class="w-full h-full"
                ></ion-icon>
              </button>

              <!-- Repeat -->
              <button
                @click="toggleRepeat"
                class="icon w-9 h-9 sm:w-11 sm:h-11 relative"
                :class="repeatModeClass"
                :style="repeatModeStyle"
              >
                <ion-icon name="repeat" class="w-full h-full"></ion-icon>
              </button>
            </div>
          </div>

          <!-- Overlay inside card -->
          <div v-if="activeMessageId === k.id" class="message-overlay">
            <div class="overlay-bg" @click="closeMessage"></div>
            <div class="overlay-sheet">
              <div class="drag-handle"></div>
              <h3 class="text-lg sm:text-xl font-semibold text-white">
                {{ k.title }}
              </h3>
              <p class="text-sm sm:text-base text-gray-200 mt-2">
                {{ k.message }}
              </p>
              <button
                @click="closeMessage"
                class="mt-4 px-4 py-2 bg-white/20 text-white rounded-xl hover:bg-white/30 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </SwiperSlide>
    </Swiper>
  </div>
</template>

<style scoped>
/* ==================== Base Card Styles ==================== */
.spotify-card {
 
  background: #000000;
  border-radius: 1rem;
  padding: 1.25rem;
  box-shadow: 0 25px 50px rgba(0, 0, 0, 0.15);
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* ==================== Header ==================== */
/* ==================== Header ==================== */
.header {
  display: flex;
  justify-content: flex-start;
  align-items: center;
  font-size: 0.75rem;
  color: #ffffff;
  margin-bottom: 0.75rem;
  width: 100%;
}

/* Small devices */
@media (min-width: 576px) {
  .header {
    font-size: 0.85rem;
    margin-bottom: 1rem;
  }
}

/* Tablets */
@media (min-width: 768px) {
  .header {
    font-size: 0.9rem;
    margin-bottom: 1.25rem;
  }
}

/* Desktop */
@media (min-width: 1024px) {
  .header {
    font-size: 1rem;
    margin-bottom: 1.5rem;
  }
}

/* Large Desktop */
@media (min-width: 1280px) {
  .header {
    font-size: 1.1rem;
  }
}

/* ==================== Album Art ==================== */
.album-art {
  width: 100%;
  max-width: 280px;
  aspect-ratio: 1;
  border-radius: 50%;
  object-fit: cover;
  margin-bottom: 1rem;
  border: 3px solid rgba(255, 255, 255, 0.4);
  box-shadow: 
    0 0 0 8px rgba(255, 255, 255, 0.1),
    0 8px 24px rgba(0, 0, 0, 0.2);
  transition: transform 0.3s ease;
}

.album-art.spinning {
  animation: spin 10s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* ==================== Song Info ==================== */
.info h2 {
  font-size: 1.1rem;
  font-weight: 600;
}

.info p {
  font-size: 0.85rem;
  color: #6b7280;
}

/* ==================== Waveform ==================== */
.wave-wrap {
  margin-top: 0.75rem;
  width: 100%;
}

.wave-wrap div {
  height: 60px;
}

/* ==================== Time Display ==================== */
.time {
  display: flex;
  justify-content: space-between;
  font-size: 0.7rem;
  color: #6b7280;
  margin-top: 0.25rem;
  width: 100%;
}

/* ==================== Controls ==================== */
.controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  margin-top: 1.25rem;
  width: 100%;
}

.icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.play {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: #111;
  color: white;
  font-size: 1.6rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.spotify-card .controls .icon ion-icon,
.spotify-card .controls .play ion-icon {
  font-size: 100%;
}

.spotify-card .controls .play ion-icon {
  font-size: 2.5rem;
}

/* ==================== Message Overlay ==================== */
.message-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 50%;
  min-height: 180px;
  max-height: 400px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  pointer-events: none;
  transition: height 0.3s ease;
}

.overlay-sheet {
  position: relative;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(15px) saturate(180%);
  -webkit-backdrop-filter: blur(15px) saturate(180%);
  border-radius: 2rem 2rem 0 0;
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 1.5rem;
  pointer-events: auto;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  animation: slide-up 0.3s ease-out;
  color: #fff;
  overflow-y: auto;
  text-align: justify;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.4) transparent;
}

.overlay-sheet::-webkit-scrollbar {
  width: 6px;
}

.overlay-sheet::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
}

.overlay-sheet::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.4);
  border-radius: 3px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.overlay-sheet::-webkit-scrollbar-thumb:hover {
  background-color: rgba(255, 255, 255, 0.6);
}

.drag-handle {
  width: 40px;
  height: 5px;
  background: #ccc;
  border-radius: 5px;
  margin-bottom: 1rem;
}

@keyframes slide-up {
  from {
    transform: translateY(100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* ==================== Responsive: Small Devices ==================== */
@media (min-width: 576px) {
  .spotify-card {
    padding: 1.5rem;
    border-radius: 1.25rem;
    align-items: center;
  }
}

/* ==================== Responsive: Tablets (Portrait) ==================== */
@media (min-width: 640px) {
  .message-overlay {
    height: 55%;
  }
  
  .spotify-card .controls .play ion-icon {
    font-size: 3rem;
  }
}

@media (min-width: 768px) {
  .spotify-card {
    padding: 2rem;
    border-radius: 1.5rem;
    box-shadow: 0 30px 60px rgba(0, 0, 0, 0.2);
    align-items: center;
  }
  
  .message-overlay {
    height: 60%;
  }
}

/* ==================== Responsive: Desktop (LANDSCAPE) ==================== */
@media (min-width: 1024px) {
  .spotify-card {
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: 3rem;
    padding: 2.5rem 3rem;
    border-radius: 2rem;
    max-width: 1000px;
  }
  
  /* Left section: Album art */
  .album-section {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  
  .album-art {
    max-width: 320px;
  }
  
  /* Right section: Controls */
  .controls-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    max-width: 500px;
  }
  
  .message-overlay {
    height: 65%;
  }
}

/* ==================== Responsive: Large Desktop ==================== */
@media (min-width: 1280px) {
  .spotify-card {
    gap: 4rem;
    padding: 3rem 4rem;
    max-width: 1100px;
  }
  
  .album-art {
    max-width: 360px;
  }
}

/* ==================== Responsive: Extra Large Desktop ==================== */
@media (min-width: 1440px) {
  .spotify-card {
    gap: 5rem;
    padding: 3.5rem 5rem;
    max-width: 1200px;
  }
  
  .album-art {
    max-width: 400px;
  }
}



@keyframes cardGlow {
  0%, 100% {
    box-shadow: 0 0 40px rgba(34, 211, 238, 0.2), 0 0 80px rgba(168, 85, 247, 0.1);
  }
  50% {
    box-shadow: 0 0 60px rgba(168, 85, 247, 0.3), 0 0 100px rgba(34, 211, 238, 0.2);
  }
}

.glitch-text {
  position: relative;
  animation: glitchText 5s infinite;
  text-shadow: 
    2px 2px 0px rgba(236, 72, 153, 0.3),
    -2px -2px 0px rgba(34, 211, 238, 0.3);
}

@keyframes glitchText {
  0%, 90%, 100% {
    transform: translate(0);
  }
  92% {
    transform: translate(-2px, 2px);
  }
  94% {
    transform: translate(2px, -2px);
  }
  96% {
    transform: translate(-2px, -2px);
  }
}



@keyframes scanline {
  0%, 100% {
    text-shadow: 0 0 10px rgba(34, 211, 238, 0.5);
  }
  50% {
    text-shadow: 0 0 20px rgba(34, 211, 238, 0.8);
  }
}

/* Force PIN display to be horizontal */
.pin-display-container {
  display: flex !important;
  flex-direction: row !important;
  justify-content: center;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
  width: 100%;
}

.pin-box {
  display: inline-flex !important;
  width: 3rem;
  height: 3rem; /* Changed to match width for perfect circle */
  align-items: center;
  justify-content: center;
  transition: all 0.3s;
  flex-shrink: 0;
  border-radius: 50%; /* Makes it circular */
}

/* ==================== iOS PIN Keypad Styles ==================== */
.ios-keypad-button {
  width: 80px;
  height: 80px;
  background: rgba(159, 163, 164, 0.1);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(237, 91, 176, 0.2);
  border-radius: 50%;
  color: rgba(207, 250, 254, 0.9);
  font-weight: 300;
  font-size: 1.875rem;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto;
  transition: all 0.15s ease;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}

.ios-keypad-button:active {
  background: rgba(133, 136, 137, 0.3);
  transform: scale(0.95);
}

.ios-keypad-clear {
  width: 80px;
  height: 80px;
  background: transparent;
  border: none;
  border-radius: 50%;
  color: rgba(248, 113, 113, 0.9);
  font-weight: 300;
  font-size: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto;
  transition: all 0.15s ease;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}

.ios-keypad-clear:active {
  background: rgba(239, 68, 68, 0.2);
  transform: scale(0.95);
}

.ios-keypad-backspace {
  width: 80px;
  height: 80px;
  background: transparent;
  border: none;
  border-radius: 50%;
  font-weight: 300;
  font-size:1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto;
  transition: all 0.15s ease;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}

.ios-keypad-backspace:active {
  background: rgba(117, 116, 118, 0.2);
  transform: scale(0.95);
}

/* Keypad container */
.ios-keypad-container {
  max-width: 300px;
  margin: 0 auto 1.5rem;
}

.ios-keypad-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
  margin-bottom: 1rem;
}

.ios-keypad-row:last-child {
  margin-bottom: 0;
}

/* Remove default button styles */
.ios-keypad-button,
.ios-keypad-clear,
.ios-keypad-backspace {
  outline: none;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
}

/* Haptic feedback simulation */
@keyframes haptic {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(0.95); }
}

.ios-keypad-button:active,
.ios-keypad-clear:active,
.ios-keypad-backspace:active {
  animation: haptic 0.1s ease;
}

/* Shake animation for incorrect PIN */


@keyframes shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
  20%, 40%, 60%, 80% { transform: translateX(5px); }
}

.pin-box.shake {
  animation: shake 0.5s ease;
}

/* Force PIN display to be horizontal */
.pin-display-container {
  display: flex !important;
  flex-direction: row !important;
  justify-content: center;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
  width: 100%;
}

.pin-box {
  display: inline-flex !important;
  align-items: center;
  justify-content: center;
  transition: all 0.3s;
  flex-shrink: 0;
}

/* Filled state */
.pin-box.filled {
  border-color: rgb(34, 211, 238);
  box-shadow: 0 0 10px rgba(34, 211, 238, 0.5);
  background: rgba(6, 182, 212, 0.2);
}

/* Error state */
.pin-box.error {
  border-color: rgb(248, 113, 113);
  box-shadow: 0 0 10px rgba(239, 68, 68, 0.5);
  background: rgba(220, 38, 38, 0.2);
  animation: shake 0.5s ease;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-8px); }
  20%, 40%, 60%, 80% { transform: translateX(8px); }
}

.logo-border {
  width: 80vw;        /* responsive width relative to viewport */
  max-width: 400px;   /* prevents it from being too large on big screens */
  height: auto;       /* height adjusts based on content */
  aspect-ratio: 16/9; /* maintains rectangular proportion */
  border-radius: 8px;
  padding: 4px;   
  background: linear-gradient(135deg, #9d9d9d, #f6a7b4, #FFC1E3); 
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 20px rgba(0,0,0,0.2); 
  transition: transform 0.3s ease;
  margin: 2rem auto;  /* centers horizontally and adds spacing */
}



.logo-border:hover {
  transform: scale(1.05); /* small hover pop effect */
}

/* Image inside the border */
.logo-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 10px;
}

.logo-video {
  width: 100%;        /* fill the container width */
  height: 100%;       /* fill the container height */
  object-fit: cover;  /* maintain aspect ratio, crop if needed */
  border-radius: 8px; /* optional, match container */
  display: block;
}



</style>