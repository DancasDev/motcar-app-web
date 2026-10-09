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
        path: 'financing',
        redirect: '/financing/groups'
      },
      {
        path: 'financing/groups',
        name: 'FinancingGroups',
        component: () => import('@/modules/financing/views/SamGroupsView.vue'),
        meta: { title: 'Autofinanciamiento Colectivo - Motcar App', requiresAuth: true, showBranchSelector: true }
      },
      {
        path: 'financing/groups/:groupId/participants',
        name: 'GroupParticipants',
        component: () => import('@/modules/financing/views/GroupParticipantsView.vue'),
        meta: { title: 'Participantes del Grupo - Motcar App', requiresAuth: true, showBranchSelector: true }
      },
      {
        path: 'accounting',
        name: 'Accounting',
        component: () => import('@/modules/accounting/views/AccountingView.vue'),
        meta: { title: 'Cobranzas - Motcar App', requiresAuth: true, showBranchSelector: true }
      }
    ]
  },
  {
    path: '/test-metadata',
    name: 'MetadataTestHarness',
    component: () => import('@/views/MetadataTestHarnessView.vue'),
    meta: { title: 'Test Harness - Metadatos', requiresAuth: false }
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/'
  }
]
