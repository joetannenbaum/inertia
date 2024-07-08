import { ReloadOptions, VoidFunction } from '@inertiajs/core'
import { router } from '@inertiajs/vue3'
import { onMounted, onUnmounted } from 'vue'

export default function usePoll(interval: number, options: ReloadOptions): VoidFunction {
  let stopFunc: VoidFunction

  let stop = () => {
    if (stopFunc) {
      stopFunc()
    }
  }

  onMounted(() => {
    stopFunc = router.poll(interval, options)
  })

  onUnmounted(() => {
    stop()
  })

  return {
    stop,
  }
}
