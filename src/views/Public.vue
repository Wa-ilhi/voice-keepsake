<script setup>
import { ref, onMounted, nextTick, computed } from "vue";
import { useRoute } from "vue-router";
import { supabase } from "../lib/supabase";
import QRCode from "qrcode";
import WaveSurfer from "wavesurfer.js";
import { Swiper, SwiperSlide } from "swiper/vue";
import "swiper/css";
import "swiper/css/pagination";
import "swiper/css/navigation";


const route = useRoute();
const keepsakes = ref([]);
const wavesurfers = ref({});
const playing = ref({});
const activeMessageId = ref(null);
const swiperRef = ref(null);
const repeatMode = ref(0);

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

async function loadKeepsakes() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const keepsakeId = route.params.id;

  const { data } = await supabase
    .from("keepsakes")
    .select("*")
    .eq("user_id", user.id)
    .eq("id", keepsakeId)
    .order("created_at", { ascending: false });

  if (!data) return;

  // Attach audio URL, QR code, and initial states
  for (let k of data) {
    const { data: signed } = await supabase.storage
      .from("keepsake-audio")
      .createSignedUrl(k.audio_path, 60 * 60);

    k.audioUrl = signed.signedUrl;
    k.qrDataUrl = await QRCode.toDataURL(`https://yourdomain.com/k/${k.id}`);
    k.currentTime = "0:00";
    k.duration = "0:00";
    playing.value[k.id] = false;
  }

  keepsakes.value = data;

  await nextTick();

  // Initialize WaveSurfer for each keepsake
  keepsakes.value.forEach((k) => {
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

  // Set active keepsake from URL
  const initialIndex = keepsakes.value.findIndex((k) => k.id === keepsakeId);
  if (initialIndex >= 0) {
    activeMessageId.value = keepsakeId;
    swiperRef.value?.slideTo(initialIndex);
  }
}

function toggleRepeat() {
  repeatMode.value = 1 - repeatMode.value; // Direct toggle: 0 ↔ 1
}

const repeatModeClass = computed(() => {
  return repeatMode.value === 0 ? "text-gray-300" : "text-spotify-green";
});

const repeatModeStyle = computed(() => {
  if (repeatMode.value === 0) return { color: '#f9f9f9' }; // gray-300
  return { color: '#1DB954' }; // spotify green for modes 1 and 2
});

// Handle logic in audio finish event
function onAudioFinish(id) {
  if (repeatMode.value === 1) {
    // Repeat is ON - replay current keepsake
    wavesurfers.value[id]?.play();
  } else {
    // No repeat - just stop
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

onMounted(loadKeepsakes);
</script>
<template>
  <div
    class="min-h-screen bg-gradient-to-br from-purple-100 via-pink-100 to-rose-100 flex items-center justify-center px-4 py-6"
  >
    <Swiper
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

</style>