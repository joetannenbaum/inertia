<script lang="ts">
import Layout from '../Components/Layout.vue'
export default { layout: Layout }
</script>

<script setup lang="ts">
import { Head, router } from '@inertiajs/vue3'
import { onMounted, onUnmounted, ref } from 'vue'

let timer = null
const reloadCount = ref(0)

const simulateToggleConflict = () => {
  router.visit('/sleepy')

  router.post(
    '/sleepy',
    {},
    {
      async: true,
    },
  )
}

const simulateConflict = () => {
  router.reload({
    only: ['sleep'],
  })
  router.visit('/sleepy')
}

const simulateCancelledRequest = () => {
  router.visit('/sleepy')
  router.reload({
    only: ['sleep'],
  })
}

const triggerLongReload = () => {
  router.reload({
    only: ['sleep'],
  })
}

onMounted(() => {
  //   timer = setTimeout(() => {
  //     router.reload({
  //       only: ['sleep'],
  //     })
  //   }, 1000)
})

onUnmounted(() => {
  clearInterval(timer)
})
</script>

<template>
  <Head title="Async Request" />
  <h1 class="text-3xl">Async Request</h1>
  <p class="mt-6">Reload Count: {{ reloadCount }}</p>
  <div class="mt-6 space-y-6">
    <div>
      <button @click="simulateConflict" class="px-4 py-2 text-white bg-green-600 rounded">Simulate Conflict</button>
    </div>
    <div>
      <button @click="simulateToggleConflict" class="px-4 py-2 text-white bg-green-600 rounded">
        Simulate Toggle Conflict
      </button>
    </div>
    <div>
      <button @click="simulateCancelledRequest" class="px-4 py-2 text-white bg-green-600 rounded">
        Simulate Cancelled Request
      </button>
    </div>
    <div>
      <button @click="triggerLongReload" class="px-4 py-2 text-white bg-green-600 rounded">Trigger Long Reload</button>
    </div>
  </div>
</template>
