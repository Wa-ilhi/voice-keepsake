<script setup>
defineProps({
  keepsake: Object,
  onDelete: Function
})
</script>

<template>
  <div class="keepsake-card flex flex-row gap-4 p-6 items-center hover:shadow-2xl transition w-full">

    
    <!-- Left: Audio / QR / placeholder -->
    <div class="w-32 h-32 bg-pink-50 rounded-xl flex items-center justify-center shrink-0 relative">
      <ion-icon name="musical-notes-outline" class="text-pink-400 text-3xl"></ion-icon>
      <!-- Floating heart -->
      <div class="absolute top-1 right-1 text-pink-400 text-xl animate-bounce">❤️</div>
    </div>

    <!-- Right: Content -->
    <div class="flex-1 flex flex-col justify-between h-full">
      <!-- Title & Message -->
      <div>
        <h2 class="text-xl font-semibold text-rose-600 truncate">
          {{ keepsake.title || 'Untitled Keepsake' }}
        </h2>
        <!-- <p class="text-gray-700 italic mt-1 line-clamp-3">
          {{ keepsake.message || 'No message provided.' }}
        </p> -->
      </div>

      <!-- Actions & Timestamp -->
      <div class="flex justify-between items-center mt-4">
        <router-link
          :to="`/listen/${keepsake.id}`"
          class="text-pink-600 hover:underline font-medium text-sm"
        >
          Listen 💌
        </router-link>
        <button
          @click="onDelete(keepsake.id)"
          class="text-red-500 hover:text-red-600 font-medium text-sm"
          :disabled="true"
          title="Delete disabled for public keepsakes"
        >
          Delete 🗑
        </button>
      </div>

      <p class="text-gray-400 text-xs mt-2 text-right">
        {{ new Date(keepsake.created_at).toLocaleString() }}
      </p>
    </div>
  </div>
</template>


<style scoped>
/* ==================== Keepsake Card Horizontal Layout ==================== */
.keepsake-card {
  display: flex;               /* horizontal layout */
  flex-direction: col;         /* left-right division */
  align-items: center;         /* vertical centering */
  gap: 1rem;                   /* space between left & right */
  padding: 1.5rem;
  border-radius: 1.5rem;
  background: #000;
  transition: all 0.3s ease;
  width: 100%;                 /* fill parent */
  max-width: 600px;            /* optional max width */
}

.keepsake-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 25px 40px rgba(0, 0, 0, 0.15);
}

/* ==================== Left Section (Icon / QR placeholder) ==================== */
.keepsake-card > div:first-child {
  flex-shrink: 0;              /* prevent shrinking */
  width: 120px;                /* fixed width for left section */
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 1rem;
  background: #ffe4e6;         /* light pink bg for placeholder */
  position: relative;
}

/* Floating heart */
.keepsake-card .heart-float {
  position: absolute;
  top: 5px;
  right: 5px;
  font-size: 1.25rem;
  color: #f472b6;
  animation: floatHeart 2.5s ease-in-out infinite;
}

@keyframes floatHeart {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-5px) scale(1.1); }
}

/* ==================== Right Section (Content) ==================== */
.keepsake-card > div:last-child {
  flex: 1;                     /* take remaining space */
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  height: 120px;
}

/* Truncate long titles/messages */
.keepsake-card h2,
.keepsake-card p {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ==================== Responsive: stack vertically on mobile ==================== */
@media (max-width: 640px) {
  .keepsake-card {
    flex-direction: column;    /* stack vertically on small screens */
    align-items: flex-start;
    height: auto;
  }

  .keepsake-card > div:last-child {
    height: auto;
  }
}



</style>
