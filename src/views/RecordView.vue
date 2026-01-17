<script setup>
import { ref } from 'vue'
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
    status.value = 'Recording ready 💕'
  }
}

async function saveKeepsake() {
  if (!audioBlob.value || !pin.value) {
    status.value = 'Please add a PIN and record audio 🔒'
    return
  }

  status.value = 'Saving your keepsake…'

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
    status.value = 'Failed to upload audio 💔'
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
    status.value = 'Failed to save keepsake 💔'
    return
  }

  status.value = 'Saved with love ❤️'
}
</script>


<template>
  <div class="min-h-screen bg-gradient-to-br from-pink-50 to-rose-100 flex items-center justify-center">
    <div class="w-full max-w-md bg-white rounded-3xl shadow-xl p-6">
      
        <ul>
             <li>
            <router-link 
              to="/dashboard" 
              class="text-gray-600 hover:text-rose-600 font-medium"
            >
              Dashboard
            </router-link>
          </li>
        </ul>
      <!-- Header -->
      <h1 class="text-2xl font-semibold text-center text-rose-600">
        Voice Keepsake
      </h1>
      <p class="text-center text-sm text-gray-500 mb-6">
        A message from the heart 💌
      </p>

      <!-- Inputs -->
      <input
        v-model="title"
        placeholder="Title (e.g. For My Love)"
        class="input"
      />

      <textarea
        v-model="message"
        placeholder="Write something meaningful…"
        rows="3"
        class="input resize-none"
      />

      <!-- Recording -->
      <div class="flex justify-center mt-4">
        <button
          v-if="!recording"
          @click="startRecording"
          class="record-btn start"
        >
          🎙 Start Recording
        </button>

        <button
          v-else
          @click="stopRecording"
          class="record-btn stop animate-pulse"
        >
          ⏹ Stop Recording
        </button>
      </div>

      <!-- Playback -->
      <div v-if="audioUrl" class="mt-5">
        <audio controls class="w-full rounded-lg">
          <source :src="audioUrl" type="audio/webm" />
        </audio>
      </div>

      <!-- Save -->
      <button
  v-if="audioBlob && pin.length >= 4"
  @click="saveKeepsake"
  class="save-btn mt-6"
>

        💾 Save Keepsake
      </button>

      <!-- Status -->
      <p class="text-center text-sm text-gray-500 mt-4">
        {{ status }}
      </p>

      <!-- PIN -->
<div class="mt-6">
  <label class="block text-sm font-medium text-gray-600 mb-2 text-center">
    🔐 Create a private PIN
  </label>

  <input
    v-model="pin"
    type="password"
    inputmode="numeric"
    maxlength="6"
    placeholder="Enter 4–6 digit PIN"
    class="w-full text-center tracking-widest text-lg px-4 py-3 rounded-xl border border-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-400"
  />

  <p class="text-xs text-gray-500 text-center mt-2">
    Only people with this PIN can listen to your voice
  </p>
</div>

    </div>
  </div>
</template>

<style scoped>
.input {
  width: 100%;
  margin-bottom: 0.75rem;
  padding: 0.6rem 0.8rem;
  border-radius: 0.75rem;
  border: 1px solid #f3c6d4;
  outline: none;
}

.input:focus {
  border-color: #f43f5e;
  box-shadow: 0 0 0 1px #f43f5e33;
}

.record-btn {
  padding: 0.6rem 1.4rem;
  border-radius: 999px;
  font-weight: 500;
  color: white;
}

.record-btn.start {
  background: linear-gradient(to right, #fb7185, #f43f5e);
}

.record-btn.stop {
  background: linear-gradient(to right, #ef4444, #dc2626);
}

.save-btn {
  width: 100%;
  padding: 0.7rem;
  border-radius: 999px;
  background: linear-gradient(to right, #ec4899, #db2777);
  color: white;
  font-weight: 600;
}
</style>
