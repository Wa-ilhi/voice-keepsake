<script setup>
import { ref } from 'vue'
import { supabase } from '../lib/supabase'
import { useRouter } from 'vue-router'

const email = ref('')
const password = ref('')
const status = ref('')
const router = useRouter()

async function signUp() {
  status.value = 'Creating account...'
  const { data, error } = await supabase.auth.signUp({
    email: email.value,
    password: password.value
  })
  if (error) status.value = error.message
  else status.value = 'Account created! Check your email to confirm.'
}

async function signIn() {
  status.value = 'Logging in...'
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value
  })
  if (error) status.value = error.message
  else {
    status.value = 'Logged in ✅'
    router.push('/record') // redirect to dashboard
  }
}
</script>

<template>
  <div class="login-form">
    <h1>Login / Sign Up</h1>
    <input v-model="email" type="email" placeholder="Email" />
    <input v-model="password" type="password" placeholder="Password" />

    <button @click="signIn">Login</button>
    <button @click="signUp">Sign Up</button>

    <p>{{ status }}</p>
  </div>
</template>

<style scoped>
.login-form { max-width:400px; margin:auto; padding:2rem; background:#fff; border-radius:12px; box-shadow:0 5px 15px rgba(0,0,0,0.05); }
input { display:block; width:100%; padding:0.5rem; margin:0.5rem 0; border-radius:8px; border:1px solid #ccc; }
button { margin:0.5rem 0.2rem; padding:0.5rem 1rem; border:none; border-radius:8px; cursor:pointer; }
button:first-of-type { background:#4caf50; color:#fff; }
button:last-of-type { background:#2196f3; color:#fff; }
</style>
