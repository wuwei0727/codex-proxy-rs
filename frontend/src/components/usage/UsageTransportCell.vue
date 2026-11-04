<script setup lang="ts">
import UsageTransportBadge from './UsageTransportBadge.vue'

defineProps<{
  upstream?: string | null
  client?: string | null
}>()
</script>

<template>
  <UsageTransportBadge
    :client-transport="client"
    :upstream-transport="upstream"
  />
</template>
