<script setup lang="ts">
const props = withDefaults(defineProps<{
  onlineLabel?: string
  offlineLabel?: string
  pollIntervalMs?: number
}>(), {
  onlineLabel: 'TiDB Online',
  offlineLabel: 'TiDB Offline',
  pollIntervalMs: 30000
})

interface HealthResponse {
  status: 'ok' | 'error'
  database: 'connected' | 'disconnected'
  latencyMs?: number
  error?: string
}

const isBrowserOnline = ref(true)
const isDbConnected = ref<boolean | null>(null)
const latencyMs = ref<number | null>(null)
const lastError = ref<string | null>(null)

const statusState = computed<'checking' | 'online' | 'offline'>(() => {
  if (!isBrowserOnline.value) {
    return 'offline'
  }
  if (isDbConnected.value === null) {
    return 'checking'
  }
  return isDbConnected.value ? 'online' : 'offline'
})

let timer: ReturnType<typeof setInterval> | null = null
let retryTimer: ReturnType<typeof setTimeout> | null = null
let consecutiveFailures = 0

async function checkHealth(isAutoRetry = false) {
  if (import.meta.client && !navigator.onLine) {
    isBrowserOnline.value = false
    isDbConnected.value = false
    lastError.value = 'Browser sedang tidak terhubung ke internet'
    return
  }

  try {
    const res = await $fetch<HealthResponse>('/api/health')
    if (res.database === 'connected') {
      consecutiveFailures = 0
      isDbConnected.value = true
      latencyMs.value = res.latencyMs ?? null
      lastError.value = null
      return
    }

    consecutiveFailures += 1
    latencyMs.value = null
    lastError.value = res.error ?? 'Database belum merespons'

    // Saat pertama kali membuka halaman (cold start TiDB / HMR), coba ulang cepat 2 detik
    if (isDbConnected.value === null && !isAutoRetry && consecutiveFailures === 1) {
      retryTimer = setTimeout(() => checkHealth(true), 2000)
      return
    }

    isDbConnected.value = false
  } catch (err: unknown) {
    consecutiveFailures += 1
    latencyMs.value = null
    lastError.value = err instanceof Error ? err.message : 'Gagal menghubungi server API /api/health'

    if (isDbConnected.value === null && !isAutoRetry && consecutiveFailures === 1) {
      retryTimer = setTimeout(() => checkHealth(true), 2000)
      return
    }

    isDbConnected.value = false
  }
}

function handleOnline() {
  isBrowserOnline.value = true
  checkHealth(false)
}

function handleOffline() {
  isBrowserOnline.value = false
  isDbConnected.value = false
}

onMounted(() => {
  isBrowserOnline.value = navigator.onLine
  checkHealth(false)
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  if (props.pollIntervalMs > 0) {
    timer = setInterval(() => checkHealth(false), props.pollIntervalMs)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('online', handleOnline)
  window.removeEventListener('offline', handleOffline)
  if (timer) {
    clearInterval(timer)
  }
  if (retryTimer) {
    clearTimeout(retryTimer)
  }
})
</script>

<template>
  <button
    type="button"
    class="inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors"
    :class="{
      'border-teal-200 bg-teal-50/80 text-teal-800 hover:bg-teal-100/80 dark:border-teal-500/30 dark:bg-teal-950/50 dark:text-teal-300 dark:hover:bg-teal-900/50': statusState === 'online',
      'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-200': statusState === 'checking',
      'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-500/40 dark:bg-rose-950/50 dark:text-rose-200': statusState === 'offline'
    }"
    :title="
      statusState === 'online' && latencyMs !== null
        ? `Latensi TiDB Cloud: ${latencyMs} ms (klik untuk cek ulang)`
        : lastError
          ? `Offline: ${lastError} (klik untuk cek ulang)`
          : 'Klik untuk cek koneksi TiDB Cloud'
    "
    @click="checkHealth()"
  >
    <span class="relative flex h-2 w-2">
      <span
        v-if="statusState === 'online'"
        class="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75"
      />
      <span
        class="relative inline-flex h-2 w-2 rounded-full"
        :class="{
          'bg-teal-500': statusState === 'online',
          'bg-amber-400': statusState === 'checking',
          'bg-rose-500': statusState === 'offline'
        }"
      />
    </span>
    <span>
      {{
        statusState === 'online'
          ? onlineLabel
          : statusState === 'checking'
            ? 'Menghubungkan...'
            : offlineLabel
      }}
    </span>
    <span
      v-if="statusState === 'online' && latencyMs !== null"
      class="hidden text-[10px] font-medium text-teal-700/70 dark:text-teal-300/70 sm:inline tabular-nums"
    >
      {{ latencyMs }}ms
    </span>
  </button>
</template>
