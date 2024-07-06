<script lang="ts">
import Layout from '../Components/Layout.vue'
export default { layout: Layout }
</script>

<script setup lang="ts">
import { Head } from '@inertiajs/vue3'

defineProps<{
  users?: {
    id: number
    name: string
    email: string
  }[]
  organizations?: {
    id: number
    name: string
    url: string
  }[]
  foods?: {
    id: number
    name: string
  }[]
}>()
</script>

<template>
  <Head title="Async Request" />
  <h1 class="text-3xl">Deferred Props</h1>
  <div class="p-4 mt-6 bg-yellow-200 border border-yellow-500 rounded">
    <p>Page is loaded!</p>
  </div>

  <div class="flex mt-6 space-x-6">
    <div class="w-1/2 p-4 border border-black rounded">
      <div v-if="!users">
        <p>Loading Users...</p>
      </div>
      <div v-else v-for="user in users">
        <p>#{{ user.id }}: {{ user.name }} ({{ user.email }})</p>
      </div>
    </div>

    <div class="w-1/2 p-4 border border-black rounded">
      <div v-if="!foods">
        <p>Loading Foods...</p>
      </div>
      <div v-else v-for="food in foods">
        <p>#{{ food.id }}: {{ food.name }}</p>
      </div>
    </div>

    <div class="w-1/2 p-4 border border-black rounded">
      <div v-if="!organizations">
        <p>Loading Organizations...</p>
      </div>
      <div v-else v-for="org in organizations">
        <p>#{{ org.id }}: {{ org.name }} ({{ org.url }})</p>
      </div>
    </div>
  </div>
</template>
