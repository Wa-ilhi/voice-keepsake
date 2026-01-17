<script setup>
import { ref, computed } from 'vue'
import { supabase } from '../lib/supabase'
import bcrypt from 'bcryptjs'

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

async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  recorder.value = new MediaRecorder(stream, { mimeType: 'audio/webm' })
  recorder.value.ondataavailable = e => chunks.value.push(e.data)
  recorder.value.start()
  recording.value = true
  status.value = 'Recording your voice…'
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
    audioFile.value = null;
    isPlaying.value = false;
    currentTime.value = 0;
    duration.value = 0;
  }
}
async function saveKeepsake() {
  if (!audioBlob.value || !pin.value || pin.value.length < 4) {
    status.value = 'Please add a PIN and record audio'
    return
  }

  isSaving.value = true
  isSaved.value = false
  status.value = '';

  try {
    const id = crypto.randomUUID()
    const path = `${id}.webm`

    // hash PIN
    const pinHash = await bcrypt.hash(pin.value, 10)

    // upload audio
    const { error: uploadError } = await supabase.storage
      .from('keepsake-audio')
      .upload(path, audioBlob.value, {
        contentType: 'audio/webm'
      })

    if (uploadError) {
      status.value = 'Failed to upload audio'
      return
    }

    // save metadata
    const { error } = await supabase.from('keepsakes').insert({
      id,
      title: title.value,
      message: message.value,
      audio_path: path,
      pin_hashed: pinHash,
      is_public: true
    })

    if (error) {
      status.value = 'Failed to save keepsake'
      return
    }

    // Success
    status.value = 'Recording saved successfully!'
    isSaved.value = true

    // ✅ Reset all input and audio after success
    audioBlob.value = null
    pin.value = ''
    title.value = ''
    message.value = ''

  } catch (err) {
    console.error(err)
    status.value = 'An unexpected error occurred'
  } finally {
    isSaving.value = false

    // Optional: reset "SAVED" button after 3 seconds
    setTimeout(() => {
      isSaved.value = false
      status.value = ''  // clear status if desired
    }, 3000)
  }
}

</script>


<template>
  <div class="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center p-4">
    <div class="w-full max-w-2xl">
      
      <!-- Studio Header -->
      <div class="studio-header">
        <div class="flex items-center justify-center gap-3 mb-2">
          <h5 class="text-3xl font-bold text-white tracking-wide">
            VOICE KEEPSAKE STUDIO
          </h5>
        </div>
      
      </div>

      <!-- Main Studio Panel -->
      <div class="studio-panel">
        
        <!-- Recording Section -->
        <div class="recording-section">
          <div class="section-header">
            <ion-icon name="mic-outline" class="text-xl"></ion-icon>
            <span>Recording Booth</span>
          </div>

         

          <!-- Microphone Control -->
         

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
              <label class="input-label">TRACK TITLE</label>
              <input
                v-model="title"
                placeholder="e.g., Message for My Love"
                class="studio-input"
              />
            </div>

            <div class="input-group">
              <label class="input-label">Track Message</label>
              <textarea
                v-model="message"
                placeholder="Add message about this recording..."
                rows="3"
                class="studio-input resize-none"
              />
            </div>

                      <div class="input-group relative">
              <label class="input-label flex items-center gap-2">
                <ion-icon name="lock-closed" class="inline text-red-500"></ion-icon>
                SECURITY PIN

                <!-- Info icon -->
                <span class="info-tooltip">
                  <ion-icon name="information-circle-outline" class="text-gray-400"></ion-icon>

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
                class="studio-input text-center tracking-widest text-xl"
              />

              <p class="note-text">
                PIN required for playback access
              </p>
            </div>

          </div>
        </div>

        <!-- Export/Save Section -->
      <div class="export-section">
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

  <p v-if="status" class="status-message">{{ status }}</p>
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
.studio-header {
  text-align: center;
  margin-bottom: .5rem;
  padding: .5rem;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.studio-panel {
  background: linear-gradient(135deg, rgba(30, 30, 30, 0.95), rgba(20, 20, 20, 0.95));
  border-radius: 1.5rem;
  padding: 2rem;
  border: 2px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(10px);
}

.section-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #ef4444;
  font-weight: 600;
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 1.5rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid rgba(239, 68, 68, 0.3);
}

/* ==================== Recording Section ==================== */
.recording-section {
  margin-bottom: 2rem;
}



.vu-meter {
  display: flex;
  gap: 3px;
  height: 80px;
  align-items: flex-end;
  justify-content: center;
  margin-bottom: 1rem;
}

.vu-bar {
  flex: 1;
  background: #1f2937;
  border-radius: 2px;
  transition: all 0.1s;
  max-width: 8px;
}

.vu-bar.active {
  background: #10b981;
}

.vu-bar.active.warm {
  background: #f59e0b;
}

.vu-bar.active.hot {
  background: #ef4444;
  box-shadow: 0 0 10px #ef4444;
}

.recording-status {
  text-align: center;
  font-family: 'Courier New', monospace;
  font-weight: bold;
  font-size: 1.25rem;
}

.status-text {
  color: #6b7280;
}

.status-text.recording-live {
  color: #ef4444;
  animation: blink 1s infinite;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0.3; }
}

/* Desktop / landscape layout */
@media (min-width: 1024px) {
  .studio-panel {
    display: flex;
    flex-direction: row;  /* side-by-side */
    gap: 5rem;
    padding: 2.5rem;
    flex-wrap: wrap; 
  }

  /* Make recording section narrower */
  .recording-section {
    flex: 1;   /* occupies less width */
    min-width: 250px;
    margin-top: 2rem;
  }

  /* Make track info / waveform wider */
  .track-info-section {
    flex: 2;   /* right panel */
    min-width: 400px;
    
  }

  /* Align export section at the bottom */
   .export-section {
    flex-basis: 100%;      /* span full width */
    margin-top: 1.5rem;    /* spacing from panels above */
  }


  /* Center mic button vertically in its section */
  .studio-mic-button {
    margin: auto;
  }
}


@media (min-width: 1024px) {
  .vu-meter {
    height: 100px; /* bigger meters on desktop */
  }

  .mic-circle {
    width: 140px;
    height: 140px;
  }

  .waveform-grid {
    height: 70px;
  }

  .studio-input {
    font-size: 1rem;
  }
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
  margin: 0 auto;      /* ⬅️ force center */
  flex-shrink: 0;      /* ⬅️ prevent shrinking */
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
  color: #ef4444;
  transition: all 0.3s;
  box-shadow: 
    0 0 20px rgba(239, 68, 68, 0.2),
    inset 0 0 20px rgba(239, 68, 68, 0.1);
}

.mic-circle:hover {
  transform: scale(1.05);
  border-color: #ef4444;
  box-shadow: 
    0 0 40px rgba(239, 68, 68, 0.4),
    inset 0 0 30px rgba(239, 68, 68, 0.2);
}

.mic-circle.recording-active {
  animation: recordPulse 1.5s ease-in-out infinite;
  border-color: #dc2626;
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



.studio-mic-button.recording::before {
  animation: ripple 2s ease-out infinite;
}

.studio-mic-button.recording::after {
  animation: ripple 2s ease-out infinite 1s;
}

@keyframes ripple {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  100% {
    transform: scale(2);
    opacity: 0;
  }
}

.mic-status {
  font-family: 'Courier New', monospace;
  font-size: 0.75rem;
  font-weight: 600;
  color: #9ca3af;
  letter-spacing: 0.15em;
}

.studio-mic-button.recording .mic-status {
  color: #ef4444;
}

/* ==================== Studio Player ==================== */
.studio-player {
  background: rgba(0, 0, 0, 0.5);
  border-radius: 1rem;
  padding: 1.5rem;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.waveform-display {
  background: #0a0a0a;
  border-radius: 0.5rem;
  padding: 1rem;
  margin-bottom: 1rem;
  border: 1px solid rgba(239, 68, 68, 0.2);
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
  background: linear-gradient(to top, #ef4444, #dc2626);
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

  border: clamp(1.5px, 0.4vw, 2px) solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.05);
  color: white;

  display:contents;
  align-items: center;
  justify-content: center;

  cursor: pointer;
  transition: transform 0.3s ease, background 0.3s ease;
  
}

/* Scale icon inside the button */
.transport-btn ion-icon,
.transport-btn svg {
  font-size: clamp(1.2rem, 4vw, 1.6rem) !important;
}

/* Touch-friendly hover / active states */
.transport-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  transform: scale(1.05);
}

.transport-btn:active {
  transform: scale(0.95);
}



.transport-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: #ef4444;
  transform: scale(1.05);
}

.transport-btn.play {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  border-color: #dc2626;
}

.transport-btn.delete  {
  border-color: rgba(239, 68, 68, 0.3);
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
  color: #ef4444;
  font-weight: bold;
  min-width: 50px;
  text-align: center;
}

.time.total {
  color: #6b7280;
}

.time-separator {
  color: #374151;
}

.timeline-container {
  cursor: pointer;
  padding: 0.5rem 0;
}

.timeline {
  position: relative;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}

.timeline-progress {
  height: 100%;
  background: linear-gradient(to right, #ef4444, #dc2626);
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
  background: #ef4444;
  border: 2px solid white;
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
  color: #9ca3af;
  letter-spacing: 0.1em;
  margin-bottom: 0.5rem;
  text-transform: uppercase;
  text-align: left;
}

.studio-input {
  width: 100%;
  padding: clamp(0.5rem, .5vw, 0.75rem);
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.5rem;
  color: white;
  font-size: clamp(0.875rem, .8vw, 1rem);
  transition: all 0.3s;
}

.studio-input:focus {
  outline: none;
  border-color: #ef4444;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
  background: rgba(0, 0, 0, 0.7);
}

.studio-input::placeholder {
  color: #6b7280;
  font-size:small;
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
  background: linear-gradient(135deg, #1d1d1d, #000000);
  color: rgb(248, 248, 248);
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

.status-message {
  margin-top: 1rem;
  color: #017a2c;
  font-size: 0.875rem;
}

/* ==================== Studio Footer ==================== */
.studio-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 2rem;
  padding: 1rem;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 0.5rem;
  border: 1px solid rgba(255, 255, 255, 0.05);
  font-size: xx-small;
}

.indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.indicator-dot {
  width: 8px;
  height: 8px;
  background: #10b981;
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

/* ==================== Responsive ==================== */
@media (max-width: 640px) {
  .studio-panel {
    padding: 1.5rem;
  }

  .mic-circle {
    width: 100px;
    height: 100px;
  }

  .waveform-grid {
    height: 50px;
  }
}


.info-tooltip {
  margin-left: auto;   /* ⬅️ pushes it to the far right */
  position: relative;
  display: inline-flex;
  align-items: center;
  cursor: pointer;
}

.info-tooltip ion-icon {
  font-size: 1.1rem;
  color: #38bdf8; 
}

.input-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* Tooltip bubble */
.tooltip-content {
  position: absolute;
  bottom: 130%;
  left: 50%;
  transform: translateX(-50%);
  width: 220px;

  background: rgba(0, 0, 0, 0.9);
  color: #fff;
  font-size: 0.75rem;
  line-height: 1.4;

  padding: 0.6rem 0.75rem;
  border-radius: 0.5rem;

  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease, transform 0.2s ease;

  z-index: 50;
}

/* Tooltip arrow */
.tooltip-content::after {
  content: "";
  position: absolute;
  top: 100%;
  left: 90%;
  transform: translateX(-50%);
  border-width: 6px;
  border-style: solid;
  border-color: rgba(0, 0, 0, 0.9) transparent transparent transparent;
}

/* Show on hover & focus (mobile friendly) */
.info-tooltip:hover .tooltip-content,
.info-tooltip:focus-within .tooltip-content {
  opacity: 1;
  transform: translateX(-90%) translateY(-4px);
}

.note-text {
  font-size: 0.75rem; /* small text, like text-xs */
  color: rgb(248, 9, 9); /* gray-400 / subtle */
  margin-top: 0.25rem;
  line-height: 1.4;
  padding: 0.3rem 0.5rem;
  border-radius: 0.25rem;
  font-style: italic;
  text-align: start;
}


</style>
