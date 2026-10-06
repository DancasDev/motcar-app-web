import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  fetchPaymentFrequencies,
  fetchContractTypes,
  fetchSamGroups,
  createSamGroup as apiCreateSamGroup,
  updateSamGroup as apiUpdateSamGroup,
  deleteSamGroup as apiDeleteSamGroup,
  fetchParticipants as apiFetchParticipants,
  createParticipant as apiCreateParticipant,
  generateGroupReceivables as apiGenerateGroupReceivables,
  generateParticipantReceivables as apiGenerateParticipantReceivables,
  fetchReceivables as apiFetchReceivables
} from '../api/financing.api'
import type {
  PaymentFrequencyItem,
  ContractTypeItem,
  NoteCategoryItem,
  SamGroupItem,
  CreateSamGroupPayload,
  UpdateSamGroupPayload,
  ParticipantItem,
  CreateParticipantPayload,
  ReceivableItem,
  GenerateReceivablesSummary
} from '../types'

export const useFinancingStore = defineStore('financing', () => {
  const samGroups = ref<SamGroupItem[]>([])
  const selectedGroupId = ref<string | number | null>(null)
  const participants = ref<ParticipantItem[]>([])
  const frequencies = ref<PaymentFrequencyItem[]>([])
  const contractTypes = ref<ContractTypeItem[]>([])
  const noteCategories = ref<NoteCategoryItem[]>([])
  const quotes = ref<ReceivableItem[]>([])
  const isLoading = ref<boolean>(false)

  const selectedGroup = computed<SamGroupItem | null>(() => {
    if (!selectedGroupId.value) return null
    return samGroups.value.find((g) => String(g.id) === String(selectedGroupId.value)) ?? null
  })

  async function loadCatalogs(): Promise<void> {
    if (frequencies.value.length > 0 && contractTypes.value.length > 0) return
    try {
      const [freqRes, typeRes] = await Promise.all([
        fetchPaymentFrequencies({ itemsPerPage: 100 }),
        fetchContractTypes({ itemsPerPage: 100 })
      ])
      frequencies.value = freqRes.data
      contractTypes.value = typeRes.data
    } catch (err) {
      console.error('Error loading financing catalogs:', err)
    }
  }

  async function loadSamGroups(
    branchId: string | number,
    force = false
  ): Promise<SamGroupItem[]> {
    if (!branchId) {
      samGroups.value = []
      return []
    }
    if (samGroups.value.length > 0 && !force) return samGroups.value

    isLoading.value = true
    try {
      const response = await fetchSamGroups(branchId, { itemsPerPage: 100 })
      samGroups.value = response.data
      if (
        samGroups.value.length > 0 &&
        (!selectedGroupId.value ||
          !samGroups.value.some((g) => String(g.id) === String(selectedGroupId.value)))
      ) {
        selectedGroupId.value = samGroups.value[0].id
      }
      return samGroups.value
    } finally {
      isLoading.value = false
    }
  }

  async function createGroup(
    branchId: string | number,
    payload: CreateSamGroupPayload
  ): Promise<number> {
    isLoading.value = true
    try {
      const response = await apiCreateSamGroup(branchId, payload)
      await loadSamGroups(branchId, true)
      return response.data.id
    } finally {
      isLoading.value = false
    }
  }

  async function updateGroup(
    branchId: string | number,
    groupId: string | number,
    payload: UpdateSamGroupPayload
  ): Promise<void> {
    isLoading.value = true
    try {
      await apiUpdateSamGroup(branchId, groupId, payload)
      await loadSamGroups(branchId, true)
    } finally {
      isLoading.value = false
    }
  }

  async function deleteGroup(
    branchId: string | number,
    groupId: string | number
  ): Promise<void> {
    isLoading.value = true
    try {
      await apiDeleteSamGroup(branchId, groupId)
      await loadSamGroups(branchId, true)
    } finally {
      isLoading.value = false
    }
  }

  async function loadParticipants(
    branchId: string | number,
    groupId: string | number
  ): Promise<ParticipantItem[]> {
    if (!branchId || !groupId) {
      participants.value = []
      return []
    }
    isLoading.value = true
    try {
      const response = await apiFetchParticipants(branchId, groupId, { itemsPerPage: 100 })
      participants.value = response.data
      return participants.value
    } finally {
      isLoading.value = false
    }
  }

  async function createParticipant(
    branchId: string | number,
    groupId: string | number,
    payload: CreateParticipantPayload
  ): Promise<number> {
    isLoading.value = true
    try {
      const response = await apiCreateParticipant(branchId, groupId, payload)
      await loadParticipants(branchId, groupId)
      return response.data.id
    } finally {
      isLoading.value = false
    }
  }

  async function generateGroupReceivables(
    branchId: string | number,
    groupId: string | number
  ): Promise<GenerateReceivablesSummary> {
    isLoading.value = true
    try {
      const response = await apiGenerateGroupReceivables(branchId, groupId)
      return response.data
    } finally {
      isLoading.value = false
    }
  }

  async function generateParticipantReceivables(
    branchId: string | number,
    groupId: string | number,
    participantId: string | number
  ): Promise<GenerateReceivablesSummary> {
    isLoading.value = true
    try {
      const response = await apiGenerateParticipantReceivables(branchId, groupId, participantId)
      return response.data
    } finally {
      isLoading.value = false
    }
  }

  async function loadParticipantQuotes(
    branchId: string | number,
    participantId: string | number
  ): Promise<ReceivableItem[]> {
    if (!branchId) return []
    isLoading.value = true
    try {
      const response = await apiFetchReceivables(branchId, {
        itemsPerPage: 100,
        filters: [
          ['origin_type', 0, '=', 'AND'],
          ['origin_id', participantId, '=', 'AND']
        ]
      })
      quotes.value = response.data
      return quotes.value
    } finally {
      isLoading.value = false
    }
  }

  return {
    samGroups,
    selectedGroupId,
    selectedGroup,
    participants,
    frequencies,
    contractTypes,
    noteCategories,
    quotes,
    isLoading,
    loadCatalogs,
    loadSamGroups,
    createGroup,
    updateGroup,
    deleteGroup,
    loadParticipants,
    createParticipant,
    generateGroupReceivables,
    generateParticipantReceivables,
    loadParticipantQuotes
  }
})
