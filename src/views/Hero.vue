<template>
  <div class="relative min-h-screen bg-gradient-to-br from-pink-50 via-rose-100 to-purple-50 flex flex-col justify-center items-center text-center px-6 sm:px-10">

   

    <!-- Hero Content -->
    <div class="z-10 max-w-3xl">
      <h1 class="text-5xl sm:text-6xl font-extrabold text-rose-600 drop-shadow-lg mb-4">
        Capture Your Love 💌
      </h1>
      <p class="text-gray-600 sm:text-lg md:text-xl mb-10 leading-relaxed">
        Create lasting voice keepsakes for your special someone.  
        Record, save, and share heartfelt messages anytime, anywhere.
      </p>

      <!-- CTA Buttons -->
      <div class="flex flex-wrap gap-4 justify-center">
        <router-link
          to="/record"
          class="px-10 py-4 bg-gradient-to-r from-rose-500 to-pink-500 text-white font-semibold rounded-full shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all"
        >
          Create Your Keepsake
        </router-link>

      </div>

     
    </div>

  </div>
</template>

<style scoped>
/* Floating hearts animation */
@keyframes floatHearts {
  0% { transform: translateY(0) rotate(0deg); opacity: 0.7; }
  50% { transform: translateY(-15px) rotate(15deg); opacity: 1; }
  100% { transform: translateY(0) rotate(-15deg); opacity: 0.7; }
}
.heart {
  animation: floatHearts 4s ease-in-out infinite;
}

/* Hero illustration floating animation */
@keyframes float {
  0% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
  100% { transform: translateY(0); }
}
.animate-float {
  animation: float 4s ease-in-out infinite;
}

/* Optional: smooth text shadow for hero heading */
h1 {
  text-shadow: 0 2px 6px rgba(255, 182, 193, 0.4);
}
</style>
