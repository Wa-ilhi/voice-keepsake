import { createRouter, createWebHistory } from 'vue-router'
import Record from '../views/RecordView.vue'
import Dashboard from '../views/Dashboard.vue'
import Login from '../user/Login.vue'
import Public from '../views/Public.vue'
import Hero from '../views/Hero.vue'

export default createRouter({
  history: createWebHistory(),
  routes: [
    {path: '/', component: Login},
    { path: '/hero', component: Hero },
    { path: '/dashboard', component: Dashboard },
    { path: '/record', component: Record },
    { path: '/listen/:id', component: Public }
  ]
})
