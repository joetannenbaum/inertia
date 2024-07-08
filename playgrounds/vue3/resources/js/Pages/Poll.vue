<script lang="ts">
import usePoll from '../../../../../packages/vue3/src/usePoll'
import Layout from '../Components/Layout.vue'
export default { layout: Layout }
</script>

<script setup lang="ts">
import { Head, router } from '@inertiajs/vue3'
import { onMounted, ref } from 'vue'

defineProps<{
  users: string[]
  companies: string[]
}>()

const userPollCount = ref(0)
const companyPollCount = ref(0)

const { stop } = usePoll(2000, {
  only: ['asdf'],
  onFinish() {
    userPollCount.value++
  },
})

onMounted(() => {
  const stopUserPolling = router.poll(1000, {
    only: ['users'],
    onFinish() {
      userPollCount.value++
    },
  })

  setTimeout(() => {
    console.log('stopping user polling')
    stopUserPolling()
  }, 7000)

  router.poll(1500, {
    only: ['companies'],
    onFinish() {
      companyPollCount.value++
    },
  })
})
</script>

<template>
  <Head title="Async Request" />
  <h1 class="text-3xl">Poll</h1>
  <div class="mt-6 space-y-6">
    <div class="font-bold">User Poll Request Count: {{ userPollCount }}</div>
    <div v-for="user in users">
      <div>{{ user }}</div>
    </div>

    <div class="font-bold">Companies Poll Request Count: {{ companyPollCount }}</div>
    <div v-for="company in companies">
      <div>{{ company }}</div>
    </div>
  </div>
</template>
