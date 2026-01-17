import { createRouter, createWebHistory } from 'vue-router'
import Record from '../views/RecordView.vue'
import Dashboard from '../views/Dashboard.vue'
import Public from '../views/Public.vue'
import Hero from '../views/Hero.vue'

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: Hero },                 // landing + CTA
    { path: '/record', component: Record },          // create keepsake + PIN
    { path: '/listen/:id', component: Public },      // PIN unlock + playback
    { path: '/dashboard', component: Dashboard }     // OPTIONAL (local-only)
  ]
})
