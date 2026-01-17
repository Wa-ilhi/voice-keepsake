import { createRouter, createWebHistory } from 'vue-router'
import Record from '../views/RecordView.vue'
import Dashboard from '../views/Dashboard.vue'
import Public from '../views/Public.vue'
import Hero from '../views/Hero.vue'
import Login from '../user/Login.vue'

export default createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: Hero }, 
    { path: '/login', component: Login },                // landing + CTA
    { path: '/record', component: Record },          // create keepsake + PIN
    { path: '/listen/:id', component: Public },      // PIN unlock + playback
    { path: '/dashboard', component: Dashboard }     // OPTIONAL (local-only)
  ]
})
