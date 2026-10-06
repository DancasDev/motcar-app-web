import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  fetchCountries,
  fetchLanguages,
  fetchTimezones,
  fetchDocumentTypes,
  fetchNotificationTypes,
  fetchCountryTimezones
} from '../api/catalogs.api'
import type {
  CountryItem,
  LanguageItem,
  TimeZoneItem,
  DocumentTypeItem,
  NotificationTypeItem,
  CountryTimeZoneItem
} from '../types'

export const useCatalogsStore = defineStore('catalogs', () => {
  // Caché en memoria
  const countries = ref<CountryItem[]>([])
  const languages = ref<LanguageItem[]>([])
  const timezones = ref<TimeZoneItem[]>([])
  const documentTypes = ref<DocumentTypeItem[]>([])
  const notificationTypes = ref<NotificationTypeItem[]>([])
  const countryTimezonesMap = ref<Record<string | number, CountryTimeZoneItem[]>>({})

  // Banderas de carga
  const isLoadingCountries = ref(false)
  const isLoadingLanguages = ref(false)
  const isLoadingTimezones = ref(false)
  const isLoadingDocumentTypes = ref(false)
  const isLoadingNotificationTypes = ref(false)
  const isLoadingCountryTimezones = ref(false)

  // Getters para elementos activos
  const activeCountries = computed(() =>
    countries.value.filter((item) => item.is_disabled === '0' || item.is_disabled === 0 || !item.is_disabled)
  )

  const activeLanguages = computed(() =>
    languages.value.filter((item) => item.is_disabled === '0' || item.is_disabled === 0 || !item.is_disabled)
  )

  const activeDocumentTypes = computed(() =>
    documentTypes.value.filter((item) => item.is_disabled === '0' || item.is_disabled === 0 || !item.is_disabled)
  )

  const activeTimezones = computed(() =>
    timezones.value.filter((item) => item.is_disabled === '0' || item.is_disabled === 0 || !item.is_disabled)
  )

  // Acciones con estrategia de caché en memoria
  async function getCountriesList(force = false): Promise<CountryItem[]> {
    if (countries.value.length > 0 && !force) {
      return countries.value
    }
    isLoadingCountries.value = true
    try {
      const res = await fetchCountries({ itemsPerPage: 255 })
      countries.value = res.data
      return countries.value
    } finally {
      isLoadingCountries.value = false
    }
  }

  async function getLanguagesList(force = false): Promise<LanguageItem[]> {
    if (languages.value.length > 0 && !force) {
      return languages.value
    }
    isLoadingLanguages.value = true
    try {
      const res = await fetchLanguages({ itemsPerPage: 255 })
      languages.value = res.data
      return languages.value
    } finally {
      isLoadingLanguages.value = false
    }
  }

  async function getTimezonesList(force = false): Promise<TimeZoneItem[]> {
    if (timezones.value.length > 0 && !force) {
      return timezones.value
    }
    isLoadingTimezones.value = true
    try {
      const res = await fetchTimezones({ itemsPerPage: 255 })
      timezones.value = res.data
      return timezones.value
    } finally {
      isLoadingTimezones.value = false
    }
  }

  async function getDocumentTypesList(force = false): Promise<DocumentTypeItem[]> {
    if (documentTypes.value.length > 0 && !force) {
      return documentTypes.value
    }
    isLoadingDocumentTypes.value = true
    try {
      const res = await fetchDocumentTypes({ itemsPerPage: 255 })
      documentTypes.value = res.data
      return documentTypes.value
    } finally {
      isLoadingDocumentTypes.value = false
    }
  }

  async function getNotificationTypesList(force = false): Promise<NotificationTypeItem[]> {
    if (notificationTypes.value.length > 0 && !force) {
      return notificationTypes.value
    }
    isLoadingNotificationTypes.value = true
    try {
      const res = await fetchNotificationTypes({ itemsPerPage: 255 })
      notificationTypes.value = res.data
      return notificationTypes.value
    } finally {
      isLoadingNotificationTypes.value = false
    }
  }

  async function getCountryTimezonesList(
    countryId: string | number,
    force = false
  ): Promise<CountryTimeZoneItem[]> {
    if (countryTimezonesMap.value[countryId] && !force) {
      return countryTimezonesMap.value[countryId]
    }
    isLoadingCountryTimezones.value = true
    try {
      const res = await fetchCountryTimezones(countryId, { itemsPerPage: 255 })
      countryTimezonesMap.value[countryId] = res.data
      return countryTimezonesMap.value[countryId]
    } finally {
      isLoadingCountryTimezones.value = false
    }
  }

  function clearCache(): void {
    countries.value = []
    languages.value = []
    timezones.value = []
    documentTypes.value = []
    notificationTypes.value = []
    countryTimezonesMap.value = {}
  }

  return {
    countries,
    languages,
    timezones,
    documentTypes,
    notificationTypes,
    countryTimezonesMap,
    isLoadingCountries,
    isLoadingLanguages,
    isLoadingTimezones,
    isLoadingDocumentTypes,
    isLoadingNotificationTypes,
    isLoadingCountryTimezones,
    activeCountries,
    activeLanguages,
    activeDocumentTypes,
    activeTimezones,
    getCountriesList,
    getLanguagesList,
    getTimezonesList,
    getDocumentTypesList,
    getNotificationTypesList,
    getCountryTimezonesList,
    clearCache
  }
})
