<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '../lib/supabase'
import KeepsakeCard from '../views/KeepsakeCard.vue'

const keepsakes = ref([])

async function fetchKeepsakes() {
  // Fetch all public keepsakes
  const { data, error } = await supabase
    .from('keepsakes')
    .select('*')
    .eq('is_public', true)           // only public keepsakes
    .order('created_at', { ascending: false }) // latest first

  if (error) console.error(error)
  else keepsakes.value = data
}

async function deleteKeepsake(id) {
  await supabase.from('keepsakes').delete().eq('id',id)
  keepsakes.value = keepsakes.value.filter(k=>k.id!==id)
}

onMounted(fetchKeepsakes)
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-purple-50 p-6">
    <div class="max-w-3xl mx-auto">
      
      <!-- Header -->
      <h1 class="text-3xl font-bold text-rose-600 text-center mb-6">
        Your Love Keepsakes ❤️
      </h1>
      <p class="text-center text-gray-500 mb-8">
        Cherish and revisit the messages you’ve created for your special someone.
      </p>

      <!-- Empty state -->
      <div v-if="keepsakes.length === 0" class="text-center text-gray-400 text-lg py-10">
        💌 No keepsakes yet. Start creating a memory today!
      </div>

      <!-- Keepsakes Grid -->
      <!-- Keepsakes Grid -->
<div v-else class="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">

  <KeepsakeCard
    v-for="k in keepsakes"
    :key="k.id"
    :keepsake="k"
    :onDelete="deleteKeepsake"
  />
</div>


    </div>
  </div>
</template>

<style scoped>
/* Optional: Add subtle floating hearts animation */
@keyframes floatHearts {
  0% { transform: translateY(0) rotate(0deg); opacity: 0.7; }
  50% { transform: translateY(-15px) rotate(15deg); opacity: 1; }
  100% { transform: translateY(0) rotate(-15deg); opacity: 0.7; }
}

.heart-float {
  display: inline-block;
  animation: floatHearts 2s ease-in-out infinite;
  color: #f43f5e;
}
</style>
