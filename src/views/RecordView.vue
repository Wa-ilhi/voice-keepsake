<script setup>
import { ref } from 'vue'
import { supabase } from '../lib/supabase'

const recording = ref(false)
const recorder = ref(null)
const chunks = ref([])
const audioUrl = ref(null)
const audioBlob = ref(null)

const title = ref('')
const message = ref('')
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
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !audioBlob.value) return

  status.value = 'Saving your keepsake…'

  const id = crypto.randomUUID()
  const path = `${user.id}/${id}.webm`

  const { error: uploadError } = await supabase.storage
    .from('keepsake-audio')
    .upload(path, audioBlob.value, {
      contentType: 'audio/webm'
    })

  if (uploadError) {
    status.value = 'Failed to save audio 💔'
    return
  }

  await supabase.from('keepsakes').insert({
    id,
    user_id: user.id,
    title: title.value,
    message: message.value,
    audio_path: path,
    is_public: true
  })

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
        v-if="audioBlob"
        @click="saveKeepsake"
        class="save-btn mt-6"
      >
        💾 Save Keepsake
      </button>

      <!-- Status -->
      <p class="text-center text-sm text-gray-500 mt-4">
        {{ status }}
      </p>
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
