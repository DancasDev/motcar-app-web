<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'
import LoginForm from '../components/LoginForm.vue'

const router = useRouter()
const route = useRoute()

function handleLoginSuccess(): void {
  const redirect = (route.query.redirect as string) || '/'
  router.push(redirect)
}
</script>

<template>
  <LoginForm @success="handleLoginSuccess" />
</template>
