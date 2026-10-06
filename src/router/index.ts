import { createRouter, createWebHistory } from 'vue-router'
import { routes } from './routes'
import { setupAuthGuard } from './guards/auth.guard'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

// Registrar guardias de navegación
setupAuthGuard(router)

export default router
