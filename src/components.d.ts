import type AppUnderConstruction from '@/components/common/AppUnderConstruction.vue'
import type AppChipFilter from '@/components/common/AppChipFilter.vue'
import type AppModal from '@/components/common/AppModal.vue'
import type AppMetadataRenderer from '@/components/common/AppMetadataRenderer.vue'
import type AppMetadataFileField from '@/components/common/AppMetadataFileField.vue'

declare module 'vue' {
  export interface GlobalComponents {
    AppUnderConstruction: typeof AppUnderConstruction
    AppChipFilter: typeof AppChipFilter
    AppModal: typeof AppModal
    AppMetadataRenderer: typeof AppMetadataRenderer
    AppMetadataFileField: typeof AppMetadataFileField
  }
}

export {}


