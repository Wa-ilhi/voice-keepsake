<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../lib/supabase'
import bcrypt from 'bcryptjs'
import { encryptAudioBlob, deriveKeyFromPin, generateSalt } from '../lib/encryption';

// Theme state
const isDarkMode = ref(true)

// Load theme preference from localStorage
onMounted(() => {
  const savedTheme = localStorage.getItem('theme')
  if (savedTheme) {
    isDarkMode.value = savedTheme === 'dark'
  }
})

// Toggle theme and save preference
function toggleTheme() {
  isDarkMode.value = !isDarkMode.value
  localStorage.setItem('theme', isDarkMode.value ? 'dark' : 'light')
}

const recording = ref(false)
const recorder = ref(null)
const chunks = ref([])
const audioUrl = ref(null)
const audioBlob = ref(null)

const title = ref('')
const message = ref('')
const pin = ref('')
const status = ref('')
const isSaving = ref(false);
const isSaved = ref(false);

const audioPlayerElement = ref(null);
const isPlaying = ref(false);
const currentTime = ref(0);
const duration = ref(0);

const imageFile = ref(null);
const imageUrl = ref(null);
const imageName = ref("");
const shareableLink = ref('');
const savedPin = ref('');
const copied = ref(false);

async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  recorder.value = new MediaRecorder(stream, { mimeType: 'audio/webm' })
  recorder.value.ondataavailable = e => chunks.value.push(e.data)
  recorder.value.start()
  recording.value = true
  status.value = 'Recording your voice…'
}

async function handleImageUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  // IMMEDIATELY read into memory
  const buffer = await file.arrayBuffer();

  imageFile.value = {
    buffer,
    type: file.type
  };
}

// Remove the selected file
function removeImage() {
  imageFile.value = null;
  imageName.value = "";
}


function stopRecording() {
  recorder.value.stop()
  recorder.value.onstop = () => {
    audioBlob.value = new Blob(chunks.value, { type: 'audio/webm' })
    audioUrl.value = URL.createObjectURL(audioBlob.value)
    chunks.value = []
    recording.value = false
    status.value = ''
  }
}

const progressPercent = computed(() => {
  if (duration.value === 0) return 0;
  return (currentTime.value / duration.value) * 100;
});

function togglePlayback() {
  if (!audioPlayerElement.value) return;
  
  if (isPlaying.value) {
    audioPlayerElement.value.pause();
  } else {
    audioPlayerElement.value.play();
  }
  isPlaying.value = !isPlaying.value;
}

function onAudioLoaded() {
  if (audioPlayerElement.value) {
    duration.value = audioPlayerElement.value.duration;
  }
}

function onTimeUpdate() {
  if (audioPlayerElement.value) {
    currentTime.value = audioPlayerElement.value.currentTime;
  }
}

function onAudioEnded() {
  isPlaying.value = false;
  currentTime.value = 0;
}

function seekAudio(event) {
  if (!audioPlayerElement.value) return;
  
  const progressContainer = event.currentTarget;
  const clickX = event.offsetX;
  const width = progressContainer.offsetWidth;
  const seekTime = (clickX / width) * duration.value;
  
  audioPlayerElement.value.currentTime = seekTime;
  currentTime.value = seekTime;
}

function formatAudioTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function deleteRecording() {
  if (confirm('Delete this recording?')) {
    if (audioPlayerElement.value) {
      audioPlayerElement.value.pause();
    }
    audioUrl.value = null;
    // audioFile.value = null;
    isPlaying.value = false;
    currentTime.value = 0;
    duration.value = 0;
  }
}

async function normalizeToArrayBuffer(data) {
  if (data instanceof ArrayBuffer) {
    return data;
  }

  if (data instanceof Blob) {
    return await data.arrayBuffer();
  }

  if (data.buffer instanceof ArrayBuffer) {
    return data.buffer; // Uint8Array
  }

  throw new Error("Unsupported audio format");
}


async function saveKeepsake() {
  if ((!audioBlob.value && !imageFile.value) || !pin.value || pin.value.length < 4) {
    status.value = 'Please add a PIN and record audio or upload an image';
    return;
  }

  isSaving.value = true;
  isSaved.value = false;
  status.value = '';

  try {
    const id = crypto.randomUUID();

    status.value = '🔐 Generating encryption keys...';

    // Generate unique salt for this keepsake
    const salt = generateSalt();

    // Derive encryption key from PIN + salt (client-side only)
    const encryptionKey = deriveKeyFromPin(pin.value, salt);

    // Hash PIN for authentication (separate from encryption)
    const pinHash = await bcrypt.hash(pin.value, 10);

    let audioPath = null;
    let imagePath = null;

    // -----------------------------
    // Upload encrypted audio
    // -----------------------------
  if (audioBlob.value) {
  status.value = '🔐 Encrypting audio...';

  const audioArrayBuffer = await normalizeToArrayBuffer(audioBlob.value);

  const encryptedAudioArrayBuffer = await encryptAudioBlob(
    audioArrayBuffer,
    encryptionKey
  );

  const encryptedAudioBlob = new Blob(
    [encryptedAudioArrayBuffer],
    { type: 'application/octet-stream' }
  );

  audioPath = `${id}_encrypted.enc`;

  status.value = '📤 Uploading encrypted audio...';

  const { error: uploadError } = await supabase.storage
    .from('keepsake-audio')
    .upload(audioPath, encryptedAudioBlob, {
      contentType: 'application/octet-stream',
      cacheControl: '3600'
    });

  if (uploadError) {
    console.error('Audio upload error:', uploadError);
    status.value = 'Failed to upload audio';
    return;
  }
}


    // -----------------------------
    // Upload encrypted image
    // -----------------------------
    if (imageFile.value) {
      status.value = '🔐 Encrypting image...';

      const encryptedImageArrayBuffer = await encryptAudioBlob(
        imageFile.value.buffer,
        encryptionKey
      );

      const encryptedImageBlob = new Blob(
        [encryptedImageArrayBuffer],
        { type: 'application/octet-stream' }
      );

      imagePath = `${id}_img_encrypted.enc`;

      status.value = '📤 Uploading encrypted image...';

      const { error: imgError } = await supabase.storage
        .from('keepsake-images')
        .upload(imagePath, encryptedImageBlob, {
          contentType: 'application/octet-stream',
          cacheControl: '3600'
        });

      if (imgError) {
        console.error('Image upload error:', imgError);
        status.value = 'Failed to upload image';
        return;
      }
    }


    // -----------------------------
    // Save metadata in DB
    // -----------------------------
    status.value = '💾 Saving keepsake...';

    const { error } = await supabase.from('keepsakes').insert({
      id,
      title: title.value,
      message: message.value,
      audio_path: audioPath,
      image_path: imagePath,
      pin_hashed: pinHash,
      encryption_key: salt, // only store salt
      is_public: true,
      created_at: new Date().toISOString(),
    });

    if (error) {
      status.value = 'Failed to save keepsake';
      console.error('Database error:', error);
      return;
    }

    // Generate shareable link
    shareableLink.value = `${window.location.origin}/listen/${id}`;
    savedPin.value = pin.value;

    status.value = '✅ Keepsake saved securely!';
    isSaved.value = true;

    // Optional: copy link to clipboard
    try {
      await navigator.clipboard.writeText(shareableLink.value);
      status.value = '✅ Link copied to clipboard!';
    } catch {
      console.log('Could not copy to clipboard');
    }

  } catch (err) {
    console.error('Save error:', err);
    status.value = 'An unexpected error occurred: ' + err.message;
  } finally {
    isSaving.value = false;
  }
  setTimeout(() => {
  status.value = '';
}, 1000);
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(shareableLink.value);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch (err) {
    console.log('Copy failed:', err);
  }
}

function createAnother() {
  shareableLink.value = '';
  savedPin.value = '';
  audioBlob.value = null;
  imageFile.value = null;
  imageUrl.value = null;
  pin.value = '';
  title.value = '';
  message.value = '';
  status.value = '';
  isSaved.value = false;
}


</script>


<template>
  <div :class="['app-container', { 'light-mode': !isDarkMode }]">
    <div class="w-full max-w-2xl">
      
      <!-- Studio Header -->
      <div class="studio-header">
        <div class="flex items-center justify-center gap-3 mb-2">
          <h5 class="header-title">
            VOICE KEEPSAKE STUDIO
          </h5>
        </div>
        
        <!-- Theme Toggle Button -->
       <button 
          @click="toggleTheme" 
          class="theme-toggle-capsule" 
          :class="{ 'light': !isDarkMode }"
          :title="isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'"
        >
          <div class="toggle-track">
            <div class="toggle-slider">
              <ion-icon v-if="isDarkMode" name="moon" class="slider-icon"></ion-icon>
              <ion-icon v-else name="sunny" class="slider-icon"></ion-icon>
            </div>
            <ion-icon name="moon-outline" class="track-icon moon"></ion-icon>
            <ion-icon name="sunny-outline" class="track-icon sun"></ion-icon>
          </div>
        </button>
      </div>

      <!-- Main Studio Panel -->
      <div class="studio-panel">
        
        <!-- Recording Section -->
        <div class="recording-section">
          <div class="section-header">
            <ion-icon name="mic-outline" class="text-xl"></ion-icon>
            <span>Recording Booth</span>
          </div>

          <!-- Audio Player -->
          <div v-if="audioUrl" class="mt-6">
            <div class="studio-player">
              <!-- Waveform -->
              <div class="waveform-display">
                <div class="waveform-grid">
                  <div 
                    v-for="i in 60" 
                    :key="i" 
                    class="waveform-bar" 
                    :class="{ active: isPlaying }"
                    :style="{ 
                      height: (Math.sin(i * 0.3) * 35 + 40) + '%',
                      animationDelay: (i * 0.015) + 's'
                    }"
                  ></div>
                </div>
              </div>

              <!-- Transport Controls -->
              <div class="transport-controls">
                <button @click="togglePlayback" class="transport-btn play">
                  <ion-icon v-if="!isPlaying" name="play" class="text-2xl"></ion-icon>
                  <ion-icon v-else name="pause" class="text-2xl"></ion-icon>
                </button>

                <div class="timecode">
                  <span class="time current">{{ formatAudioTime(currentTime) }}</span>
                  <span class="time-separator">|</span>
                  <span class="time total">{{ formatAudioTime(duration) }}</span>
                </div>

                <button @click="deleteRecording" class="transport-btn delete">
                  <ion-icon name="trash-outline" class="text-2xl"></ion-icon>
                </button>
              </div>

              <!-- Progress Bar -->
              <div class="timeline-container" @click="seekAudio">
                <div class="timeline">
                  <div class="timeline-progress" :style="{ width: progressPercent + '%' }"></div>
                  <div class="playhead" :style="{ left: progressPercent + '%' }"></div>
                </div>
              </div>

              <audio
                ref="audioPlayerElement"
                :src="audioUrl"
                @loadedmetadata="onAudioLoaded"
                @timeupdate="onTimeUpdate"
                @ended="onAudioEnded"
              ></audio>
            </div>
          </div>

          <div class="flex justify-center mt-6">
            <button
              v-if="!recording"
              @click="startRecording"
              class="studio-mic-button"
            >
              <div class="mic-circle">
                <ion-icon name="mic" class="text-5xl"></ion-icon>
              </div>
              <span class="mic-status">PRESS TO RECORD</span>
            </button>

            <button
              v-else
              @click="stopRecording"
              class="studio-mic-button recording"
            >
              <div class="mic-circle recording-active">
                <ion-icon name="stop" class="text-5xl"></ion-icon>
              </div>
              <span class="mic-status">STOP RECORDING</span>
            </button>
            <div class="recording-status">
              <span v-if="!recording" class="status-text">READY</span>
              <span v-else class="status-text recording-live">● REC</span>
            </div>
          </div>

        </div>

        <!-- Track Info Section -->
        <div class="track-info-section">
          <div class="section-header">
            <ion-icon name="bookmarks-outline" class="text-xl"></ion-icon>
            <span>Track Information</span>
          </div>

          <div class="space-y-4 mt-4">
            <div class="input-group">
              <label class="input-label">Salutation</label>
              <input
                v-model="title"
                placeholder="e.g., Dearest Love,"
                class="studio-input"
              />
            </div>

            <div class="input-group">
              <label class="input-label">Message</label>
              <textarea
                v-model="message"
                placeholder="Add message..."
                rows="3"
                class="studio-input resize-none"
              />
            </div>

           <div class="input-group relative">
            <label class="input-label flex items-center gap-2 w-full">
              <ion-icon name="lock-closed" class="inline text-red-500"></ion-icon>
              SECURITY PIN

              
              <span class="info-tooltip ml-auto">
                <ion-icon
                  name="information-circle-outline"
                  class="info-icon"
                ></ion-icon>

                <span class="tooltip-content">
                  This 4-digit PIN is required to play the voice keepsake.
                  Only people with the PIN can access playback.
                </span>
              </span>
            </label>

            <input
              v-model="pin"
              type="password"
              inputmode="numeric"
              maxlength="4"
              placeholder="4 digits only"
              class="studio-input text-center tracking-widest text-xl w-full"
            />

            <p class="note-text">
              PIN required for playback access
            </p>
          </div>

          </div>
          <div class="input-group mt-4">
            <label class="input-label">Attach an Image</label>
            <input
              type="file"
              accept="image/*"
              @change="handleImageUpload"
              class="studio-input"
            />

            <!-- Show only the filename like Gmail -->
            <div v-if="imageName" class="image-filename mt-2 flex items-center gap-2">
              <span class="filename-badge">
                {{ imageName }}
              </span>
              <button
                @click="removeImage"
                class="remove-btn"
              >
                Remove
              </button>
            </div>
          </div>

        </div>

        <!-- Export/Save Section -->
        <div class="export-section">
          <!-- Status + Shareable Link -->
          <div v-if="status || shareableLink" class="status-container mt-4 flex flex-col items-center gap-2 text-center">
            <!-- Status message -->
            <p v-if="status" class="status-message text-sm sm:text-base">
              {{ status }}
            </p>

            <!-- Clickable link -->
            <span v-if="shareableLink" class="text-sm flex items-center gap-2">
              <!-- Indicator -->
              <span class="link-indicator"></span>

              <!-- Link -->
              <a
                :href="shareableLink"
                target="_blank"
                class="preview-link"
              >
                Click to Preview
                <!-- Optional external icon -->
                <ion-icon name="open-outline" class="text-[12px]"></ion-icon>
              </a>
            </span>
          </div>
          <br>

          <button
            v-if="audioBlob && pin.length >= 4"
            @click="saveKeepsake"
            class="export-btn"
            :disabled="isSaving || isSaved"
          >
            <ion-icon
              v-if="!isSaving && !isSaved"
              name="save-outline"
              class="text-2xl"
            ></ion-icon>
            <ion-icon
              v-else-if="isSaving"
              name="refresh-outline"
              class="text-2xl animate-spin"
            ></ion-icon>
            <ion-icon
              v-else
              name="checkmark-outline"
              class="text-2xl"
            ></ion-icon>

            <span>
              {{ isSaving ? 'SAVING...' : isSaved ? 'SAVED' : 'SAVE RECORDING' }}
            </span>
          </button>
        </div>

      </div>

      <!-- Studio Footer -->
      <div class="studio-footer">
        <div class="indicator">
          <span class="indicator-dot"></span>
          <span>SESSION ACTIVE</span>
        </div>
        <div class="text-xs">
          <p class="credits-subtext">2026 | Voice Keepsake</p>
        </div>
      </div>

    </div>
  </div>
</template>

<style scoped>
/* ==================== Theme Variables ==================== */
.app-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  transition: background 0.3s ease;
  border-radius: .75rem;
  
  /* Dark Mode (Default) */
  background:#0a0a0a;
  --bg-header: rgba(0, 0, 0, 0.5);
  --bg-panel: linear-gradient(135deg, rgba(30, 30, 30, 0.95), rgba(20, 20, 20, 0.95));
  --bg-input: rgba(0, 0, 0, 0.5);
  --bg-input-focus: rgba(0, 0, 0, 0.7);
  --bg-player: rgba(0, 0, 0, 0.5);
  --bg-waveform: #0a0a0a;
  --bg-footer: rgba(0, 0, 0, 0.3);
  
  --text-primary: #ffffff;
  --text-secondary: #9ca3af;
  --text-muted: #6b7280;
  --text-input-placeholder: #6b7280;
  
  --border-primary: rgba(255, 255, 255, 0.596);
  --border-secondary: rgba(255, 255, 255, 0.1);
  --border-input: rgba(255, 255, 255, 0.1);
  --border-section: rgba(239, 68, 68, 0.3);
  
  --accent-color: #ef4444;
  --accent-hover: #dc2626;
  --success-color: #10b981;
}

/* Light Mode */
.app-container.light-mode {
  background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 50%, #7dd3fc 100%);
  --bg-header: rgba(255, 255, 255, 0.8);
  --bg-panel: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(248, 250, 252, 0.95));
  --bg-input: rgba(255, 255, 255, 0.8);
  --bg-input-focus: rgba(255, 255, 255, 1);
  --bg-player: rgba(248, 250, 252, 0.9);
  --bg-waveform: #f1f5f9;
  --bg-footer: rgba(255, 255, 255, 0.5);
  
  --text-primary: #0f172a;
  --text-secondary: #475569;
  --text-muted: #64748b;
  --text-input-placeholder: #94a3b8;
  
  --border-primary: rgba(15, 23, 42, 0.2);
  --border-secondary: rgba(15, 23, 42, 0.1);
  --border-input: rgba(15, 23, 42, 0.15);
  --border-section: rgba(239, 68, 68, 0.4);
  
  --accent-color: #dc2626;
  --accent-hover: #b91c1c;
  --success-color: #059669;
}

/* ==================== Theme Toggle Capsule Button ==================== */
.theme-toggle-capsule {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: transparent;
  border: none;
  cursor: pointer;
  z-index: 100;
  padding: 0;
  transition: transform 0.2s ease;
}

.theme-toggle-capsule:hover {
  transform: scale(1.05);
}

.theme-toggle-capsule:active {
  transform: scale(0.98);
}

.toggle-track {
  position: relative;
  width: 80px;
  height: 40px;
  background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
  border-radius: 20px;
  border: 2px solid rgba(255, 255, 255, 0.15);
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 
    inset 0 2px 6px rgba(0, 0, 0, 0.4),
    0 4px 12px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

.theme-toggle-capsule.light .toggle-track {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  border-color: rgba(251, 191, 36, 0.4);
  box-shadow: 
    inset 0 2px 6px rgba(0, 0, 0, 0.1),
    0 4px 16px rgba(251, 191, 36, 0.5),
    0 0 20px rgba(251, 191, 36, 0.3);
}

.toggle-slider {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 32px;
  height: 32px;
  background: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 
    0 2px 8px rgba(0, 0, 0, 0.3),
    0 0 0 1px rgba(255, 255, 255, 0.1);
  z-index: 2;
}

.theme-toggle-capsule.light .toggle-slider {
  transform: translateX(42px);
  background: #ffffff;
  box-shadow: 
    0 2px 8px rgba(0, 0, 0, 0.2),
    0 0 0 1px rgba(251, 191, 36, 0.2);
}

.slider-icon {
  font-size: 20px !important;
  display: block !important;
  transition: all 0.3s ease;
}

.theme-toggle-capsule .slider-icon {
  color: #1e293b;
}

.theme-toggle-capsule.light .slider-icon {
  color: #f59e0b;
}

.track-icon {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  font-size: 18px !important;
  display: block !important;
  transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 1;
}

.track-icon.moon {
  left: 10px;
  color: rgba(255, 255, 255, 0.6);
}

.track-icon.sun {
  right: 10px;
  color: rgba(255, 255, 255, 0.3);
}

.theme-toggle-capsule.light .track-icon.moon {
  color: rgba(0, 0, 0, 0.2);
}

.theme-toggle-capsule.light .track-icon.sun {
  color: rgba(255, 255, 255, 0.9);
}

/* Glow effect on hover */
.theme-toggle-capsule:hover .toggle-track {
  box-shadow: 
    inset 0 2px 6px rgba(0, 0, 0, 0.4),
    0 4px 16px rgba(0, 0, 0, 0.4),
    0 0 24px rgba(239, 68, 68, 0.3);
}

.theme-toggle-capsule.light:hover .toggle-track {
  box-shadow: 
    inset 0 2px 6px rgba(0, 0, 0, 0.1),
    0 4px 20px rgba(251, 191, 36, 0.6),
    0 0 32px rgba(251, 191, 36, 0.4);
}

/* ==================== Header ==================== */
.studio-header {
  position: relative;
  text-align: center;
  margin-bottom: .5rem;
  padding: .5rem;
  background: var(--bg-header);
  border-radius: 1rem;
  border: 1px solid var(--border-primary);
  backdrop-filter: blur(10px);
}

.header-title {
  font-size: 1.875rem;
  font-weight: bold;
  color: var(--text-primary);
  letter-spacing: 0.05em;
}

/* ==================== Main Panel ==================== */
.studio-panel {
  background: var(--bg-panel);
  border-radius: 1.5rem;
  padding: 2rem;
  border: 2px solid var(--border-secondary);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
}

.section-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--accent-color);
  font-weight: 600;
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 1.5rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--border-section);
}

/* ==================== Recording Section ==================== */
.recording-section {
  margin-bottom: 2rem;
}

.recording-status {
  text-align: center;
  font-family: 'Courier New', monospace;
  font-weight: bold;
  font-size: 1.25rem;
}

.status-text {
  color: var(--text-muted);
}

.status-text.recording-live {
  color: var(--accent-color);
  animation: blink 1s infinite;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0.3; }
}

/* ==================== Microphone Button ==================== */
.studio-mic-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  background: transparent;
  border: none;
  cursor: pointer;
  position: relative;
  margin: 0 auto;
  flex-shrink: 0;
}

.mic-circle {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(239, 68, 68, 0.2), rgba(220, 38, 38, 0.1));
  border: 3px solid rgba(239, 68, 68, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-color);
  transition: all 0.3s;
  box-shadow: 
    0 0 20px rgba(239, 68, 68, 0.2),
    inset 0 0 20px rgba(239, 68, 68, 0.1);
}

.light-mode .mic-circle {
  background: radial-gradient(circle, rgba(220, 38, 38, 0.15), rgba(185, 28, 28, 0.05));
  border: 3px solid rgba(220, 38, 38, 0.4);
}

.mic-circle:hover {
  transform: scale(1.05);
  border-color: var(--accent-color);
  box-shadow: 
    0 0 40px rgba(239, 68, 68, 0.4),
    inset 0 0 30px rgba(239, 68, 68, 0.2);
}

.mic-circle.recording-active {
  animation: recordPulse 1.5s ease-in-out infinite;
  border-color: var(--accent-hover);
}

@keyframes recordPulse {
  0%, 100% {
    box-shadow: 
      0 0 30px rgba(239, 68, 68, 0.5),
      0 0 60px rgba(239, 68, 68, 0.3),
      inset 0 0 30px rgba(239, 68, 68, 0.2);
  }
  50% {
    box-shadow: 
      0 0 50px rgba(239, 68, 68, 0.7),
      0 0 90px rgba(239, 68, 68, 0.5),
      inset 0 0 50px rgba(239, 68, 68, 0.3);
  }
}

.mic-status {
  font-family: 'Courier New', monospace;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
  letter-spacing: 0.15em;
}

.studio-mic-button.recording .mic-status {
  color: var(--accent-color);
}

/* ==================== Studio Player ==================== */
.studio-player {
  background: var(--bg-player);
  border-radius: 1rem;
  padding: 1.5rem;
  border: 1px solid var(--border-secondary);
}

.waveform-display {
  background: var(--bg-waveform);
  border-radius: 0.5rem;
  padding: 1rem;
  margin-bottom: 1rem;
  border: 1px solid var(--border-section);
}

.waveform-grid {
  display: flex;
  gap: 2px;
  height: 60px;
  align-items: center;
  justify-content: center;
}

.waveform-bar {
  flex: 1;
  background: linear-gradient(to top, var(--accent-color), var(--accent-hover));
  border-radius: 1px;
  opacity: 0.3;
  transition: all 0.2s;
  min-height: 2px;
}

.waveform-bar.active {
  animation: waveAnim 1.2s ease-in-out infinite;
  opacity: 0.8;
}

@keyframes waveAnim {
  0%, 100% { transform: scaleY(1); }
  50% { transform: scaleY(1.3); }
}

.transport-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.transport-btn {
  width: clamp(40px, 10vw, 56px);
  height: clamp(40px, 10vw, 56px);
  border-radius: 50%;
  border: clamp(1.5px, 0.4vw, 2px) solid var(--border-input);
  background: var(--bg-input);
  color: var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.3s ease, background 0.3s ease;
}

.transport-btn ion-icon,
.transport-btn svg {
  font-size: clamp(1.2rem, 4vw, 1.6rem) !important;
  display: block !important;
}

.transport-btn:hover {
  background: var(--bg-input-focus);
  border-color: var(--accent-color);
  transform: scale(1.05);
}

.transport-btn:active {
  transform: scale(0.95);
}

.transport-btn.play {
  background: linear-gradient(135deg, var(--accent-color), var(--accent-hover));
  border-color: var(--accent-hover);
  color: white;
}

.transport-btn.delete {
  border-color: var(--border-section);
}

.transport-btn.delete:hover {
  background: rgba(239, 68, 68, 0.2);
}

.timecode {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  font-family: 'Courier New', monospace;
  font-size: 1.125rem;
}

.time {
  color: var(--accent-color);
  font-weight: bold;
  min-width: 50px;
  text-align: center;
}

.time.total {
  color: var(--text-muted);
}

.time-separator {
  color: var(--text-muted);
}

.timeline-container {
  cursor: pointer;
  padding: 0.5rem 0;
}

.timeline {
  position: relative;
  height: 4px;
  background: var(--border-input);
  border-radius: 2px;
}

.timeline-progress {
  height: 100%;
  background: linear-gradient(to right, var(--accent-color), var(--accent-hover));
  border-radius: 2px;
  transition: width 0.1s linear;
  box-shadow: 0 0 10px rgba(239, 68, 68, 0.5);
}

.playhead {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 12px;
  height: 12px;
  background: var(--accent-color);
  border: 2px solid var(--text-primary);
  border-radius: 50%;
  box-shadow: 0 0 10px rgba(239, 68, 68, 0.8);
  transition: left 0.1s linear;
}

.timeline-container:hover .playhead {
  transform: translate(-50%, -50%) scale(1.3);
}

/* ==================== Track Info Section ==================== */
.track-info-section {
  margin-bottom: 2rem;
  padding-top: 2rem;
}

.input-group {
  margin-bottom: 1rem;
}

.input-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
  letter-spacing: 0.1em;
  margin-bottom: 0.5rem;
  text-transform: uppercase;
  text-align: left;
  width: 100%;
}

.studio-input {
  width: 100%;
  padding: clamp(0.5rem, .5vw, 0.75rem);
  background: var(--bg-input);
  border: 1px solid var(--border-input);
  border-radius: 0.5rem;
  color: var(--text-primary);
  font-size: clamp(0.875rem, .8vw, 1rem);
  transition: all 0.3s;
}

.studio-input:focus {
  outline: none;
  border-color: var(--accent-color);
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
  background: var(--bg-input-focus);
}

.studio-input::placeholder {
  color: var(--text-input-placeholder);
  font-size: small;
}

/* ==================== Info Tooltip ==================== */
.info-tooltip {
  position: relative;
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  margin-left: auto;
}

.info-tooltip .info-icon {
  font-size: 0.875rem;
  color: #38bdf8;
  align-content: center;
}

.light-mode .info-icon {
  color: #0284c7;
}

.tooltip-content {
  position: absolute;
  bottom: 130%;
  left: 0%; /* Changed from left: 50% to right: 0 */
  transform: translateX(0); /* Reset transform */
  width: 220px;
  background: rgba(0, 0, 0, 0.95);
  color: #fff;
  font-size: 0.75rem;
  line-height: 1.5;
  padding: 0.6rem 0.75rem;
  border-radius: 0.5rem;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease, transform 0.2s ease;
  z-index: 50;
}

.light-mode .tooltip-content {
  background: rgba(15, 23, 42, 0.95);
}

.tooltip-content::after {
  content: "";
  position: absolute;
  top: 100%;
  left: 9px; /* Changed from left: 90% to right: 10px */
  transform: translateX(0); /* Reset transform */
  border-width: 6px;
  border-style: solid;
  border-color: rgba(0, 0, 0, 0.95) transparent transparent transparent;
}

.light-mode .tooltip-content::after {
  border-color: rgba(15, 23, 42, 0.95) transparent transparent transparent;
}

.info-tooltip:hover .tooltip-content,
.info-tooltip:focus-within .tooltip-content {
  opacity: 1;
  transform: translateY(-4px); /* Changed from translateX(-90%) translateY(-4px) */
}

.note-text {
  font-size: 0.75rem;
  color: var(--accent-color);
  margin-top: 0.25rem;
  line-height: 1.4;
  padding: 0.3rem 0.5rem;
  border-radius: 0.25rem;
  font-style: italic;
  text-align: start;
}


/* ==================== Image Upload ==================== */
.filename-badge {
  color: var(--text-primary);
  background: var(--bg-input);
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  border: 1px solid var(--border-input);
}

.remove-btn {
  font-size: 0.875rem;
  color: var(--accent-color);
  text-decoration: underline;
  background: none;
  border: none;
  cursor: pointer;
}

.remove-btn:hover {
  color: var(--accent-hover);
}

/* ==================== Export Section ==================== */
.export-section {
  text-align: center;
  padding-top: 2rem;
}

.export-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 2rem;
  background: linear-gradient(135deg, var(--accent-color), var(--accent-hover));
  color: white;
  border: none;
  border-radius: 0.75rem;
  font-weight: 700;
  font-size: 0.875rem;
  letter-spacing: 0.1em;
  cursor: pointer;
  transition: all 0.3s;
  box-shadow: 0 4px 20px rgba(239, 68, 68, 0.4);
}

.export-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 30px rgba(239, 68, 68, 0.6);
}

.export-btn:active {
  transform: translateY(0);
}

.export-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.status-message {
  margin-top: 1rem;
  color: var(--success-color);
  font-size: 0.875rem;
  font-weight: 500;
}

.link-indicator {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: var(--success-color);
  animation: pulse 2s ease-in-out infinite;
}

.preview-link {
  text-decoration: underline;
  color: var(--text-primary);
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  transition: color 0.3s;
}

.preview-link:hover {
  color: var(--success-color);
}

/* ==================== Studio Footer ==================== */
.studio-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 2rem;
  padding: 1rem;
  background: var(--bg-footer);
  border-radius: 0.5rem;
  border: 1px solid var(--border-secondary);
  font-size: xx-small;
  backdrop-filter: blur(10px);
}

.indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.indicator-dot {
  width: 8px;
  height: 8px;
  background: var(--success-color);
  border-radius: 50%;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
  }
  50% {
    opacity: 0.5;
    box-shadow: 0 0 0 6px rgba(16, 185, 129, 0);
  }
}

.credits-subtext {
  color: var(--text-muted);
}

/* ==================== Responsive Layout ==================== */

/* Mobile First - Base styles for mobile */
@media (max-width: 640px) {
  /* Container padding */
  .app-container {
    padding: 0.5rem;
  }

  /* Header adjustments */
  .studio-header {
    margin-bottom: 0.75rem;
    padding: 0.75rem 0.5rem;
  }

  .header-title {
    font-size: 1.25rem;
    letter-spacing: 0.02em;
  }

  /* Theme toggle - smaller on mobile */
  .theme-toggle-capsule {
    top: 0.5rem;
    right: 0.5rem;
 
  }

  .toggle-track {
    width: 65px;
    height: 34px;
  }

  .toggle-slider {
    width: 28px;
    height: 28px;
  }

  .theme-toggle-capsule.light .toggle-slider {
    transform: translateX(33px);
  }

  .slider-icon {
    font-size: 16px !important;
  }

  .track-icon {
    font-size: 14px !important;
  }

  .track-icon.moon {
    left: 8px;
  }

  .track-icon.sun {
    right: 8px;
  }

  /* Main panel */
  .studio-panel {
    padding: 1rem;
    border-radius: 1rem;
  }

  /* Section headers */
  .section-header {
    font-size: 0.75rem;
    margin-bottom: 1rem;
    padding-bottom: 0.5rem;
  }

  .section-header ion-icon {
    font-size: 1rem;
  }

  /* Recording section */
  .recording-section {
    margin-bottom: 1.5rem;
  }

  /* Microphone button */
  .mic-circle {
    width: 90px;
    height: 90px;
  }

  .mic-circle ion-icon {
    font-size: 2.5rem !important;
  }

  .mic-status {
    font-size: 0.65rem;
  }

  .recording-status {
    font-size: 1rem;
  }

  /* Audio player */
  .studio-player {
    padding: 1rem;
  }

  .waveform-display {
    padding: 0.75rem;
  }

  .waveform-grid {
    height: 45px;
  }

  /* Transport controls */
  .transport-controls {
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .transport-btn {
    width: 44px;
    height: 44px;
  }

  .transport-btn ion-icon {
    font-size: 1.25rem !important;
  }

  .timecode {
    font-size: 0.875rem;
    gap: 0.5rem;
    width: 100%;
    order: -1;
    margin-bottom: 0.5rem;
  }

  .time {
    min-width: 40px;
  }

  /* Track info section */
  .track-info-section {
    padding-top: 1rem;
    margin-bottom: 1.5rem;
  }

  .input-group {
    margin-bottom: 0.875rem;
    margin-right: 1.5rem;
  }

  .input-label {
    font-size: 0.7rem;
    margin-bottom: 0.375rem;
  }

  .studio-input {
    padding: 0.625rem;
    font-size: 0.875rem;
  }

  .studio-input[type="password"] {
    font-size: 1.125rem;
  }

  textarea.studio-input {
    font-size: 0.875rem;
  }

  /* Tooltip adjustments */
  .tooltip-content {
    width: 180px;
    font-size: 0.7rem;
    padding: 0.5rem;
  }

  .info-icon {
    font-size: 1rem;
  }

  /* Export section */
  .export-section {
    padding-top: 1rem;
  }

  .export-btn {
    width: 100%;
    padding: 0.875rem 1.5rem;
    font-size: 0.75rem;
  }

  .export-btn ion-icon {
    font-size: 1.25rem !important;
  }

  .status-message {
    font-size: 0.75rem;
  }

  .preview-link {
    font-size: 0.75rem;
  }

  /* Footer */
  .studio-footer {
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem;
    margin-top: 1rem;
    text-align: center;
  }

  .indicator {
    font-size: 0.65rem;
  }

  .indicator-dot {
    width: 6px;
    height: 6px;
  }

  .credits-subtext {
    font-size: 0.65rem;
  }
}

/* Tablet styles */
@media (min-width: 641px) and (max-width: 1023px) {
  .app-container {
    padding: 1rem;
  }

  .studio-panel {
    padding: 1.75rem;
  }

  .header-title {
    font-size: 1.5rem;
  }

  .mic-circle {
    width: 110px;
    height: 110px;
  }

  .waveform-grid {
    height: 55px;
  }

  .transport-btn {
    width: 48px;
    height: 48px;
  }

  .timecode {
    font-size: 1rem;
  }
}

/* Desktop styles */
@media (min-width: 1024px) {
  .studio-panel {
    display: flex;
    flex-direction: row;
    gap: 3rem;
    padding: 2.5rem;
    flex-wrap: wrap; 
  }

  .recording-section {
    flex: 1;
    min-width: 280px;
    max-width: 350px;
    margin-top: 2rem;
  }

  .track-info-section {
    flex: 2;
    min-width: 400px;
  }

  .export-section {
    flex-basis: 100%;
    margin-top: 1.5rem;
  }

  .studio-mic-button {
    margin: auto;
  }

  .mic-circle {
    width: 140px;
    height: 140px;
  }

  .waveform-grid {
    height: 70px;
  }

  .transport-btn {
    width: 56px;
    height: 56px;
  }

  .timecode {
    font-size: 1.125rem;
  }
}

/* Large desktop optimization */
@media (min-width: 1280px) {
  .studio-panel {
    gap: 4rem;
    max-width: 1200px;
    margin: 0 auto;
  }
}

/* Landscape mobile orientation */
@media (max-width: 896px) and (orientation: landscape) {
  .app-container {
    padding: 0.5rem;
  }

  .studio-header {
    margin-bottom: 0.5rem;
    padding: 0.5rem;
  }

  .header-title {
    font-size: 1rem;
  }

  .studio-panel {
    padding: 1rem;
  }

  .section-header {
    font-size: 0.7rem;
    margin-bottom: 0.75rem;
  }

  .mic-circle {
    width: 80px;
    height: 80px;
  }

  .recording-section,
  .track-info-section,
  .export-section {
    margin-bottom: 1rem;
  }

  .studio-footer {
    padding: 0.5rem;
    margin-top: 0.75rem;
  }
}

/* Touch device optimizations */
@media (hover: none) and (pointer: coarse) {
  /* Increase touch targets */
  .transport-btn,
  .export-btn,
  .theme-toggle-capsule,
  .studio-mic-button {
    min-height: 44px;
    min-width: 44px;
  }

  /* Prevent hover effects on touch */
  .transport-btn:hover,
  .mic-circle:hover,
  .theme-toggle-capsule:hover {
    transform: none;
  }

  /* Active/tap feedback instead */
  .transport-btn:active {
    transform: scale(0.95);
  }

  .mic-circle:active {
    transform: scale(0.98);
  }

  .theme-toggle-capsule:active {
    transform: scale(0.96);
  }

  /* Increase input padding for easier tapping */
  .studio-input {
    padding: 0.75rem;
  }
}

/* High resolution displays */
@media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi) {
  .timeline {
    height: 6px;
  }

  .playhead {
    width: 14px;
    height: 14px;
  }

  .waveform-bar {
    border-radius: 2px;
  }
}
</style>