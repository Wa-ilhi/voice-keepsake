<script setup>
defineProps({
  keepsake: Object,
  onDelete: Function
})
</script>

<template>
  <div class="bg-white rounded-2xl shadow-lg p-5 hover:shadow-xl transition relative overflow-hidden">
    
    <!-- Heart Accent -->
    <div class="absolute top-2 right-3 text-pink-400 text-xl heart-float">
      ❤️
    </div>

    <!-- Title -->
    <h2 class="text-xl font-semibold text-rose-600 mb-2">
      {{ keepsake.title }}
    </h2>

    <!-- Message -->
    <p class="text-gray-600 mb-4 italic">“{{ keepsake.message }}”</p>

    <!-- Actions -->
    <div class="flex justify-between items-center">
      <router-link
        :to="`/listen/${keepsake.id}`"
        class="text-pink-600 hover:underline font-medium"
      >
        Listen 💌
      </router-link>

      <button
        @click="onDelete(keepsake.id)"
        class="text-red-500 hover:text-red-600 font-medium"
      >
        Delete 🗑
      </button>
    </div>

    <!-- Timestamp -->
    <p class="text-gray-400 text-xs mt-3">
      {{ new Date(keepsake.created_at).toLocaleString() }}
    </p>

  </div>
</template>

<style scoped>
/* Rounded cards with soft shadows */
</style>
