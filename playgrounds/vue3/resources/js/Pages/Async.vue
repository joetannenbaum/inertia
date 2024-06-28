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

onMounted(() => {
  console.log('on mounted')

  //   timer = setTimeout(() => {
  //     router.reload({
  //       only: ['sleep'],
  //     })
  //     reloadCount.value++
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
  <div>
    <button @click="simulateConflict" class="mt-6">Simulate Conflict</button>
  </div>
  <div>
    <button @click="simulateToggleConflict" class="mt-6">Simulate Toggle Conflict</button>
  </div>
  <div>
    <button @click="simulateCancelledRequest" class="mt-6">Simulate Cancelled Request</button>
  </div>
</template>
