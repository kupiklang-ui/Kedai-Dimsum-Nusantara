import type { DriverOrderItem, DriverOrdersResponse } from '~/types/pos'

const acknowledgedInvoices = new Set<string>()
let pollTimer: ReturnType<typeof setInterval> | null = null
let activeSubscribers = 0
let inFlight = false
let hasFetchedOnce = false

function playNotificationChime() {
  if (!import.meta.client) return
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const now = ctx.currentTime

    const notes = [880, 1174.66]
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now + idx * 0.12)

      gain.gain.setValueAtTime(0.001, now + idx * 0.12)
      gain.gain.exponentialRampToValueAtTime(0.14, now + idx * 0.12 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.12 + 0.32)

      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + idx * 0.12)
      osc.stop(now + idx * 0.12 + 0.34)
    })

    setTimeout(() => {
      ctx.close().catch(() => {})
    }, 800)
  } catch {
    // Abaikan jika audio diblokir browser sebelum interaksi
  }
}

export function useDriverOrderAlerts() {
  const pendingOrders = useState<DriverOrderItem[]>('pos-driver-pending-orders', () => [])
  const soundEnabled = useState<boolean>('pos-driver-alert-sound', () => true)

  const visibleOrders = computed(() =>
    pendingOrders.value.filter(order => !acknowledgedInvoices.has(order.no_faktur))
  )

  function acknowledgeAll() {
    for (const order of pendingOrders.value) {
      acknowledgedInvoices.add(order.no_faktur)
    }
    pendingOrders.value = []
  }

  async function checkForNewDriverOrders(playSoundOnNew = true) {
    if (!import.meta.client || inFlight) return
    inFlight = true
    try {
      const res = await $fetch<DriverOrdersResponse>('/api/driver-orders', {
        query: { status: 'Sedang Diolah' }
      })

      const previousIds = new Set(pendingOrders.value.map(o => o.no_faktur))
      const unacknowledged = res.orders.filter(o => !acknowledgedInvoices.has(o.no_faktur))
      const hasBrandNew = unacknowledged.some(o => !previousIds.has(o.no_faktur))

      pendingOrders.value = unacknowledged

      if (hasBrandNew && playSoundOnNew && soundEnabled.value && hasFetchedOnce) {
        playNotificationChime()
      }
      hasFetchedOnce = true
    } catch {
      // Abaikan error jaringan sementara saat polling
    } finally {
      inFlight = false
    }
  }

  function startListening() {
    if (!import.meta.client) return
    activeSubscribers += 1
    checkForNewDriverOrders(true)

    if (!pollTimer) {
      pollTimer = setInterval(() => {
        checkForNewDriverOrders(true)
      }, 5000)
    }
  }

  function stopListening() {
    if (!import.meta.client) return
    activeSubscribers = Math.max(0, activeSubscribers - 1)
    if (activeSubscribers === 0 && pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  return {
    pendingOrders,
    visibleOrders,
    soundEnabled,
    acknowledgeAll,
    checkForNewDriverOrders,
    startListening,
    stopListening
  }
}
