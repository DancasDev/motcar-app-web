import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { vuetify } from './plugins/vuetify'
import router from './router'
import App from './App.vue'
import AppUnderConstruction from './components/common/AppUnderConstruction.vue'
import AppChipFilter from './components/common/AppChipFilter.vue'
import AppModal from './components/common/AppModal.vue'
import AppMetadataRenderer from './components/common/AppMetadataRenderer.vue'
import AppMetadataFileField from './components/common/AppMetadataFileField.vue'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(vuetify)

app.component('AppUnderConstruction', AppUnderConstruction)
app.component('AppChipFilter', AppChipFilter)
app.component('AppModal', AppModal)
app.component('AppMetadataRenderer', AppMetadataRenderer)
app.component('AppMetadataFileField', AppMetadataFileField)

app.mount('#app')



