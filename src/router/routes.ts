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
        path: 'directories',
        redirect: '/directories/persons'
      },
      {
        path: 'directories/persons',
        name: 'DirectoriesPersons',
        component: () => import('@/modules/directories/views/PersonsView.vue'),
        meta: { title: 'Directorios - Personas - Motcar App', requiresAuth: true, showBranchSelector: true }
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
        path: 'financing/defaulters',
        name: 'FinancingDefaulters',
        component: () => import('@/modules/financing/views/DefaultersView.vue'),
        meta: { title: 'Cartera de Morosos - Motcar App', requiresAuth: true, showBranchSelector: true }
      },
      {
        path: 'financing/calendar',
        name: 'FinancingCalendar',
        component: () => import('@/modules/financing/views/CollectionCalendarView.vue'),
        meta: { title: 'Calendario de Cobros - Motcar App', requiresAuth: true, showBranchSelector: true }
      },
      {
        path: 'financing/awarded',
        name: 'FinancingAwarded',
        component: () => import('@/modules/financing/views/AwardedBenefitsView.vue'),
        meta: { title: 'Beneficios Adjudicados - Motcar App', requiresAuth: true, showBranchSelector: true }
      },
      {
        path: 'accounting',
        redirect: '/accounting/receivables'
      },
      {
        path: 'accounting/receivables',
        name: 'AccountingReceivables',
        component: () => import('@/modules/accounting/views/AccountsReceivableView.vue'),
        meta: { title: 'Cuentas por Cobrar - Motcar App', requiresAuth: true, showBranchSelector: true }
      },
      {
        path: 'accounting/receipts',
        name: 'AccountingReceipts',
        component: () => import('@/modules/accounting/views/ReceiptsView.vue'),
        meta: { title: 'Recibos de Pago y Caja - Motcar App', requiresAuth: true, showBranchSelector: true }
      },
      {
        path: 'accounting/treasury',
        name: 'AccountingTreasury',
        component: () => import('@/modules/accounting/views/TreasuryView.vue'),
        meta: { title: 'Tesorería y Bancos - Motcar App', requiresAuth: true, showBranchSelector: true }
      },
      {
        path: 'accounting/exchange-rates',
        name: 'AccountingExchangeRates',
        component: () => import('@/modules/accounting/views/ExchangeRatesView.vue'),
        meta: { title: 'Tasas de Cambio - Motcar App', requiresAuth: true, showBranchSelector: true }
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
