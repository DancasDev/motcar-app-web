import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  fetchBranches,
  fetchBranchTree,
  createBranch as apiCreateBranch,
  updateBranch as apiUpdateBranch,
  deleteBranch as apiDeleteBranch,
  restoreBranch as apiRestoreBranch
} from '../api/branches.api'
import type {
  BranchItem,
  BranchTreeMap,
  CreateBranchPayload,
  UpdateBranchPayload
} from '../types'

const CURRENT_BRANCH_KEY = 'current_branch_id'

export const useBranchesStore = defineStore('branches', () => {
  const branchesList = ref<BranchItem[]>([])
  const branchTree = ref<BranchTreeMap>({})
  const activeBranchId = ref<string | null>(localStorage.getItem(CURRENT_BRANCH_KEY))
  const isLoading = ref<boolean>(false)

  const activeBranch = computed<BranchItem | null>(() => {
    if (!activeBranchId.value) return null
    return branchesList.value.find((b) => String(b.id) === String(activeBranchId.value)) ?? null
  })

  function setActiveBranch(branchId: string | number | null): void {
    if (branchId !== null && branchId !== undefined && branchId !== '') {
      activeBranchId.value = String(branchId)
      localStorage.setItem(CURRENT_BRANCH_KEY, String(branchId))
    } else {
      activeBranchId.value = null
      localStorage.removeItem(CURRENT_BRANCH_KEY)
    }
  }

  async function loadBranches(force = false): Promise<BranchItem[]> {
    if (branchesList.value.length > 0 && !force) {
      return branchesList.value
    }
    isLoading.value = true
    try {
      const response = await fetchBranches({ itemsPerPage: 100 })
      branchesList.value = response.data

      // Auto-seleccionar sucursal si no hay una activa o si la activa no existe en la lista
      if (branchesList.value.length > 0) {
        const found = branchesList.value.find(
          (b) => String(b.id) === String(activeBranchId.value)
        )
        if (!found) {
          setActiveBranch(branchesList.value[0].id)
        }
      }
      return branchesList.value
    } finally {
      isLoading.value = false
    }
  }

  async function loadBranchTree(): Promise<BranchTreeMap> {
    isLoading.value = true
    try {
      const response = await fetchBranchTree()
      if (Array.isArray(response.data)) {
        branchTree.value = {}
      } else {
        branchTree.value = response.data || {}
      }
      return branchTree.value
    } finally {
      isLoading.value = false
    }
  }

  async function createBranch(payload: CreateBranchPayload): Promise<number> {
    isLoading.value = true
    try {
      const response = await apiCreateBranch(payload)
      await loadBranches(true)
      await loadBranchTree()
      return response.data.id
    } finally {
      isLoading.value = false
    }
  }

  async function updateBranch(
    branchId: string | number,
    payload: UpdateBranchPayload
  ): Promise<void> {
    isLoading.value = true
    try {
      await apiUpdateBranch(branchId, payload)
      await loadBranches(true)
      await loadBranchTree()
    } finally {
      isLoading.value = false
    }
  }

  async function deleteBranch(branchId: string | number): Promise<void> {
    isLoading.value = true
    try {
      await apiDeleteBranch(branchId)
      await loadBranches(true)
      await loadBranchTree()
      // Si la sucursal activa fue eliminada, seleccionar otra
      if (String(activeBranchId.value) === String(branchId)) {
        setActiveBranch(branchesList.value[0]?.id ?? null)
      }
    } finally {
      isLoading.value = false
    }
  }

  async function restoreBranch(branchId: string | number): Promise<void> {
    isLoading.value = true
    try {
      await apiRestoreBranch(branchId)
      await loadBranches(true)
      await loadBranchTree()
    } finally {
      isLoading.value = false
    }
  }

  return {
    branchesList,
    branchTree,
    activeBranchId,
    activeBranch,
    isLoading,
    setActiveBranch,
    loadBranches,
    loadBranchTree,
    createBranch,
    updateBranch,
    deleteBranch,
    restoreBranch
  }
})
