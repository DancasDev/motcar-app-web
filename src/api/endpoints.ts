export const ENDPOINTS = {
  AUTH: {
    USER: {
      LOGIN: '/v1/auth/user',
      GET_SESSION: '/v1/auth/user',
      REFRESH: '/v1/auth/user',
      LOGOUT: '/v1/auth/user',
      SIGNATURE: '/v1/auth/user/signature'
    },
    CLIENT: {
      LOGIN: '/v1/auth/client',
      GET_SESSION: '/v1/auth/client',
      REFRESH: '/v1/auth/client',
      LOGOUT: '/v1/auth/client'
    }
  },
  CATALOGS: {
    COUNTRIES: '/v1/catalogs/countries',
    COUNTRY_TIMEZONES: (countryId: string | number) => `/v1/catalogs/countries/${countryId}/timezones`,
    TIMEZONES: '/v1/catalogs/timezones',
    DOCUMENT_TYPES: '/v1/catalogs/document-types',
    NOTIFICATION_TYPES: '/v1/catalogs/notification-types',
    LANGUAGES: '/v1/catalogs/languages',
    PERSONS: '/v1/catalogs/persons',
    PERSON_BY_ID: (id: string | number) => `/v1/catalogs/persons/${id}`
  },
  MY: {
    NOTIFICATIONS: '/v1/my/notifications',
    UNREAD_COUNT: '/v1/my/notifications/unread-count',
    NOTIFICATION_BY_ID: (notificationId: string | number) => `/v1/my/notifications/${notificationId}`,
    CHANNELS: '/v1/my/notifications/channels',
    BINNACLES: '/v1/my/binnacles',
    PASSWORD: '/v1/my/profile/password'
  },
  ACCESS: {
    ROLES: '/v1/access/roles',
    ROLE_BY_ID: (roleId: string | number) => `/v1/access/roles/${roleId}`,
    ROLE_PERMISSIONS: (roleId: string | number) => `/v1/access/roles/${roleId}/permissions`,
    ROLE_PERMISSION_BY_ID: (roleId: string | number, permissionId: string | number) =>
      `/v1/access/roles/${roleId}/permissions/${permissionId}`,
    MODULES: '/v1/access/modules',
    MODULE_CATEGORIES: '/v1/access/modules/categories',
    USERS: '/v1/access/users',
    USER_ROLES: (userId: string | number) => `/v1/access/users/${userId}/roles`,
    USER_ROLE_BY_ID: (userId: string | number, roleEntityId: string | number) =>
      `/v1/access/users/${userId}/roles/${roleEntityId}`,
    CLIENTS: '/v1/access/clients',
    CLIENT_BY_ID: (clientId: string | number) => `/v1/access/clients/${clientId}`,
    CLIENT_ROLES: (clientId: string | number) => `/v1/access/clients/${clientId}/roles`,
    CLIENT_ROLE_BY_ID: (clientId: string | number, roleEntityId: string | number) =>
      `/v1/access/clients/${clientId}/roles/${roleEntityId}`
  },
  BRANCHES: {
    BASE: '/v1/branches',
    TREE: '/v1/branches/tree',
    BY_ID: (branchId: string | number) => `/v1/branches/${branchId}`
  },
  FINANCING: {
    FREQUENCIES: '/v1/financing/frequencies',
    CONTRACT_TYPES: '/v1/financing/contracts/types',
    NOTE_CATEGORIES: '/v1/financing/notes/categories',
    GROUPS: (branchId: string | number) => `/v1/branches/${branchId}/financing/groups`,
    GROUP_BY_ID: (branchId: string | number, groupId: string | number) =>
      `/v1/branches/${branchId}/financing/groups/${groupId}`,
    GROUP_QUALIFIED: (branchId: string | number, groupId: string | number) =>
      `/v1/branches/${branchId}/financing/groups/${groupId}/qualified-participants`,
    GROUP_GENERATE_RECEIVABLES: (branchId: string | number, groupId: string | number) =>
      `/v1/branches/${branchId}/financing/groups/${groupId}/generate-receivables`,
    PARTICIPANTS: (branchId: string | number, groupId: string | number) =>
      `/v1/branches/${branchId}/financing/groups/${groupId}/participants`,
    PARTICIPANT_BY_ID: (
      branchId: string | number,
      groupId: string | number,
      participantId: string | number
    ) => `/v1/branches/${branchId}/financing/groups/${groupId}/participants/${participantId}`,
    PARTICIPANT_GENERATE_RECEIVABLES: (
      branchId: string | number,
      groupId: string | number,
      participantId: string | number
    ) =>
      `/v1/branches/${branchId}/financing/groups/${groupId}/participants/${participantId}/generate-receivables`,
    CONTRACT: (branchId: string | number, groupId: string | number, participantId: string | number) =>
      `/v1/branches/${branchId}/financing/groups/${groupId}/participants/${participantId}/contract`,
    CONTRACT_SIGN: (
      branchId: string | number,
      groupId: string | number,
      participantId: string | number
    ) =>
      `/v1/branches/${branchId}/financing/groups/${groupId}/participants/${participantId}/contract/sign`,
    CONTRACT_PDF: (
      branchId: string | number,
      groupId: string | number,
      participantId: string | number
    ) =>
      `/v1/branches/${branchId}/financing/groups/${groupId}/participants/${participantId}/contract/pdf`
  },
  ACCOUNTING: {
    // Maestros Globales
    CURRENCIES: '/v1/accounting/currencies',
    CURRENCY_BY_ID: (id: string | number) => `/v1/accounting/currencies/${id}`,
    EXCHANGE_RATES: (currencyId: string | number) =>
      `/v1/accounting/currencies/${currencyId}/exchange-rates`,
    CURRENT_EXCHANGE_RATE: (currencyId: string | number) =>
      `/v1/accounting/currencies/${currencyId}/exchange-rates/current`,
    EXCHANGE_RATE_BY_ID: (currencyId: string | number, rateId: string | number) =>
      `/v1/accounting/currencies/${currencyId}/exchange-rates/${rateId}`,
    PAYMENT_CATEGORIES: '/v1/accounting/payments/categories',
    PAYMENT_CATEGORY_BY_ID: (id: string | number) => `/v1/accounting/payments/categories/${id}`,
    PAYMENT_CATEGORY_SCHEMA: (id: string | number) =>
      `/v1/accounting/payments/categories/${id}/schema`,
    CATEGORY_PAYMENT_ACCOUNTS: (categoryId: string | number) =>
      `/v1/accounting/payments/categories/${categoryId}/accounts`,
    CATEGORY_PAYMENT_ACCOUNT_BY_ID: (
      categoryId: string | number,
      accountId: string | number
    ) => `/v1/accounting/payments/categories/${categoryId}/accounts/${accountId}`,
    PAYMENT_ACCOUNTS: '/v1/accounting/payments/accounts',
    RECEIVABLE_CONCEPTS: '/v1/accounting/receivables/concepts',
    RECEIVABLE_CONCEPT_BY_ID: (id: string | number) => `/v1/accounting/receivables/concepts/${id}`,

    // Operaciones por Sucursal
    RECEIVABLES: (branchId: string | number) => `/v1/branches/${branchId}/accounting/receivables`,
    RECEIVABLE_BY_ID: (branchId: string | number, receivableId: string | number) =>
      `/v1/branches/${branchId}/accounting/receivables/${receivableId}`,
    RECEIVABLES_OVERDUE_SYNC: (branchId: string | number) =>
      `/v1/branches/${branchId}/accounting/receivables/overdue-sync`,
    RECEIPTS: (branchId: string | number) => `/v1/branches/${branchId}/accounting/receipts`,
    RECEIPT_BY_ID: (branchId: string | number, receiptId: string | number) =>
      `/v1/branches/${branchId}/accounting/receipts/${receiptId}`,
    RECEIPT_DETAIL: (branchId: string | number, receiptId: string | number) =>
      `/v1/branches/${branchId}/accounting/receipts/${receiptId}/detail`,
    RECEIPT_STATUS: (branchId: string | number, receiptId: string | number) =>
      `/v1/branches/${branchId}/accounting/receipts/${receiptId}/status`,
    RECEIPT_PDF: (branchId: string | number, receiptId: string | number) =>
      `/v1/branches/${branchId}/accounting/receipts/${receiptId}/pdf`,
    RECEIPT_ITEMS: (branchId: string | number, receiptId: string | number) =>
      `/v1/branches/${branchId}/accounting/receipts/${receiptId}/items`,
    RECEIPT_ITEM_BY_ID: (
      branchId: string | number,
      receiptId: string | number,
      itemId: string | number
    ) => `/v1/branches/${branchId}/accounting/receipts/${receiptId}/items/${itemId}`,
    RECEIPT_PAYMENTS: (branchId: string | number, receiptId: string | number) =>
      `/v1/branches/${branchId}/accounting/receipts/${receiptId}/payments`,
    RECEIPT_PAYMENT_BY_ID: (
      branchId: string | number,
      receiptId: string | number,
      paymentId: string | number
    ) => `/v1/branches/${branchId}/accounting/receipts/${receiptId}/payments/${paymentId}`,
    CREDITS: (branchId: string | number) => `/v1/branches/${branchId}/accounting/credits`,
    CREDIT_BY_ID: (branchId: string | number, creditId: string | number) =>
      `/v1/branches/${branchId}/accounting/credits/${creditId}`,
    CREDIT_VOID: (branchId: string | number, creditId: string | number) =>
      `/v1/branches/${branchId}/accounting/credits/${creditId}/void`
  },
  SYSTEM: {
    // Auditoría (Bitácoras)
    BINNACLES: '/v1/system/binnacles',
    BINNACLE_BY_ID: (id: string | number) => `/v1/system/binnacles/${id}`,
    BINNACLE_FROM_ENTITIES: '/v1/system/binnacles/from/entities',
    BINNACLE_EXPORT: (format: string) => `/v1/system/binnacles/export/${format}`,

    // Almacenamiento (Storage y Lockers)
    STORAGE_UPLOAD: (lockerKey: string) => `/v1/system/storage/${lockerKey}`,
    STORAGE_LOCKERS: '/v1/system/storage/lockers',
    STORAGE_LOCKER_BY_ID: (id: string | number) => `/v1/system/storage/lockers/${id}`,
    STORAGE_LOCKER_FILES: (id: string | number) => `/v1/system/storage/lockers/${id}/files`,
    STORAGE_LOCKER_FILE_DELETE: (id: string | number, filename: string) =>
      `/v1/system/storage/lockers/${id}/files/${filename}`,
    STORAGE_DOWNLOAD: '/v1/system/storage/download',

    // Metadatos Dinámicos (EAV)
    METADATA_SCHEMAS: '/v1/system/metadata',
    METADATA_SCHEMA_BY_ID: (id: string | number) => `/v1/system/metadata/${id}`,
    METADATA_SCHEMA_RENDER: (id: string | number) => `/v1/system/metadata/${id}/schema`,
    METADATA_FIELDS: (schemaId: string | number) => `/v1/system/metadata/${schemaId}/fields`,
    METADATA_FIELD_BY_ID: (schemaId: string | number, fieldId: string | number) =>
      `/v1/system/metadata/${schemaId}/fields/${fieldId}`,
    METADATA_FIELD_TYPES: '/v1/system/metadata/fields/types',
    METADATA_FIELD_RULES: '/v1/system/metadata/fields/rules',

    // Servicios Auxiliares e Invitaciones
    INVITATIONS: '/v1/system/services/invitations',
    INVITATION_BY_USER_ID: (userId: string | number) =>
      `/v1/system/services/invitations/${userId}`,
    INVITATION_SETUP: '/v1/system/services/invitations/setup',
    PASSWORD_RECOVERY: '/v1/system/services/password/recovery'
  }
} as const
