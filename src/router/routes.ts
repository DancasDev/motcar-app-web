import type { RouteRecordRaw } from 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    title?: string
    requiresAuth?: boolean
    guestOnly?: boolean
    isForced?: boolean
    showBranchSelector?: boolean
  }
}

export const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    component: () => import('@/layouts/AuthLayout.vue'),
    meta: { guestOnly: true, showBranchSelector: false },
    children: [
      {
        path: '',
        name: 'Login',
        component: () => import('@/modules/auth/views/LoginView.vue'),
        meta: { title: 'Iniciar Sesión - Motcar App', guestOnly: true, showBranchSelector: false }
      }
    ]
  },
  {
    path: '/recovery',
    component: () => import('@/layouts/AuthLayout.vue'),
    meta: { guestOnly: true, showBranchSelector: false },
    children: [
      {
        path: '',
        name: 'Recovery',
        component: () => import('@/modules/auth/views/RecoveryView.vue'),
        meta: { title: 'Recuperar Contraseña - Motcar App', guestOnly: true, showBranchSelector: false }
      }
    ]
  },
  {
    path: '/force-password-change',
    name: 'ForcePasswordChange',
    component: () => import('@/modules/auth/views/ForcePasswordChangeView.vue'),
    meta: { title: 'Actualización Requerida - Motcar App', requiresAuth: true, isForced: true, showBranchSelector: false }
  },
  {
    path: '/',
    component: () => import('@/layouts/DashboardLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'Home',
        component: () => import('@/views/HomeView.vue'),
        meta: { title: 'Inicio - Motcar App', requiresAuth: true, showBranchSelector: true }
      },
      {
        path: 'catalogs',
        name: 'Catalogs',
        component: () => import('@/modules/catalogs/views/CatalogsView.vue'),
        meta: { title: 'Catálogos - Motcar App', requiresAuth: true, showBranchSelector: true }
      },
      {
        path: 'my/account',
        name: 'MyAccount',
        component: () => import('@/modules/my/views/MyAccountView.vue'),
        meta: { title: 'Mi Cuenta - Motcar App', requiresAuth: true, showBranchSelector: false }
      },
      {
        path: 'access',
        name: 'Access',
        component: () => import('@/modules/access/views/AccessView.vue'),
        meta: { title: 'Control de Acceso - Motcar App', requiresAuth: true, showBranchSelector: false }
      },
      {
        path: 'branches',
        name: 'Branches',
        component: () => import('@/modules/branches/views/BranchesView.vue'),
        meta: { title: 'Sucursales - Motcar App', requiresAuth: true, showBranchSelector: false }
      },
      {
        path: 'financing',
        name: 'Financing',
        component: () => import('@/modules/financing/views/FinancingView.vue'),
        meta: { title: 'Financiamiento (SAM) - Motcar App', requiresAuth: true, showBranchSelector: true }
      },
      {
        path: 'accounting',
        name: 'Accounting',
        component: () => import('@/modules/accounting/views/AccountingView.vue'),
        meta: { title: 'Contabilidad y Tesorería - Motcar App', requiresAuth: true, showBranchSelector: true }
      },
      {
        path: 'system',
        name: 'System',
        component: () => import('@/modules/system/views/SystemView.vue'),
        meta: { title: 'Sistema y Auditoría - Motcar App', requiresAuth: true, showBranchSelector: false }
      }
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]
