<script setup lang="ts">
import type { StockRequestItem, StockRequestsResponse } from '~/types/pos'

const pendingRequests = ref<StockRequestItem[]>([])
const dismissedIds = ref<Set<number>>(new Set())
const soundEnabled = ref(true)
let pollTimer: ReturnType<typeof setInterval> | null = null
let inFlight = false
let hasFetchedOnce = false

function playAdminAlertChime() {
  if (!import.meta.client) return
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const now = ctx.currentTime
    const notes = [659.25, 880, 1046.5]
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now + idx * 0.1)
      gain.gain.setValueAtTime(0.001, now + idx * 0.1)
      gain.gain.exponentialRampToValueAtTime(0.13, now + idx * 0.1 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.1 + 0.28)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + idx * 0.1)
      osc.stop(now + idx * 0.1 + 0.3)
    })
    setTimeout(() => ctx.close().catch(() => {}), 900)
  } catch {
    // Ignore autoplay restrictions
  }
}

const visibleRequests = computed(() =>
  pendingRequests.value.filter(r => !dismissedIds.value.has(r.id_request))
)

const totalRequestedPcs = computed(() =>
  visibleRequests.value.reduce((sum, r) => sum + r.qty_diminta, 0)
)

const latestRequest = computed(() => visibleRequests.value[0] || null)

async function pollStockRequests() {
  if (!import.meta.client || inFlight) return
  inFlight = true
  try {
    const res = await $fetch<StockRequestsResponse>('/api/stock-requests')
    const waiting = res.requests.filter(r => r.status === 'Menunggu Admin')

    const prevIds = new Set(pendingRequests.value.map(r => r.id_request))
    const hasBrandNew = waiting.some(r => !prevIds.has(r.id_request) && !dismissedIds.value.has(r.id_request))

    pendingRequests.value = waiting

    if (hasBrandNew && soundEnabled.value && hasFetchedOnce) {
      playAdminAlertChime()
    }
    hasFetchedOnce = true
  } catch {
    // Ignore transient network errors
  } finally {
    inFlight = false
  }
}

function dismissAll() {
  const next = new Set(dismissedIds.value)
  for (const r of visibleRequests.value) {
    next.add(r.id_request)
  }
  dismissedIds.value = next
}

function goToProductions() {
  dismissAll()
  navigateTo('/productions')
}

onMounted(() => {
  pollStockRequests()
  pollTimer = setInterval(pollStockRequests, 5000)
})

onBeforeUnmount(() => {
  if (pollTimer) clearInterval(pollTimer)
})
</script>

<template>
  <Teleport to="body">
    <div
      class="pointer-events-none fixed inset-x-0 top-3 z-[70] flex justify-center px-3 sm:top-4 sm:px-4"
      aria-live="polite"
    >
      <Transition name="stock-banner">
        <div
          v-if="visibleRequests.length > 0 && latestRequest"
          class="pointer-events-auto relative w-full max-w-2xl overflow-hidden rounded-2xl border border-rose-200/90 border-l-[5px] border-l-[#c94538] bg-white p-4 text-[#0f213d] shadow-[0_16px_42px_rgba(15,33,61,0.2)] dark:border-rose-500/40 dark:border-l-[#ee6352] dark:bg-[#111d33] dark:text-white dark:shadow-[0_18px_48px_rgba(0,0,0,0.65)] sm:p-5"
        >
          <div class="flex items-start gap-3.5">
            <!-- Coral Alert Bell -->
            <div class="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#c94538] text-white shadow-sm">
              <span class="absolute -right-1 -top-1 flex h-3.5 w-3.5">
                <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                <span class="relative inline-flex h-3.5 w-3.5 rounded-full bg-[#9e2118] ring-2 ring-white dark:ring-[#111d33]" />
              </span>
              <UIcon name="i-heroicons-bell-alert" class="h-6 w-6" />
            </div>

            <div class="min-w-0 flex-1 pr-6">
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="text-sm font-extrabold tracking-tight text-[#0f213d] dark:text-white sm:text-base">
                  {{ visibleRequests.length }} Pengajuan Pasokan Dimsum dari Kasir
                </h3>
                <span class="rounded-full bg-[#fde4e2] px-2.5 py-0.5 text-[11px] font-bold text-[#b83227] dark:bg-rose-950/70 dark:text-rose-300">
                  {{ latestRequest.stok_saat_lapor <= 0 ? 'Stok Habis!' : 'Stok Menipis' }}
                </span>
              </div>

              <p class="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300 sm:text-[13px]">
                <strong>{{ latestRequest.kasir_nama }}</strong> mengajukan
                <strong class="text-[#c94538] dark:text-rose-300">+{{ totalRequestedPcs }} Pcs</strong>
                (sisa saat lapor: <strong>{{ latestRequest.stok_saat_lapor }} pcs</strong>)
                <span v-if="latestRequest.catatan_kasir"> · "{{ latestRequest.catatan_kasir }}"</span>
              </p>

              <div class="mt-3.5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  class="inline-flex items-center gap-2 rounded-lg bg-[#0d6e66] px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-[#095750] active:scale-[0.98]"
                  @click="goToProductions"
                >
                  <UIcon name="i-heroicons-fire" class="h-4 w-4" />
                  <span>Proses Produksi &amp; Kirim Stok →</span>
                </button>

                <button
                  type="button"
                  class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:bg-[#0b1424] dark:text-slate-300"
                  :title="soundEnabled ? 'Matikan suara bel' : 'Nyalakan suara bel'"
                  @click="soundEnabled = !soundEnabled"
                >
                  <UIcon :name="soundEnabled ? 'i-heroicons-speaker-wave' : 'i-heroicons-speaker-x-mark'" class="h-4 w-4" />
                </button>
              </div>
            </div>

            <button
              type="button"
              class="absolute right-3 top-3 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
              aria-label="Tutup notifikasi"
              @click="dismissAll"
            >
              <UIcon name="i-heroicons-x-mark" class="h-5 w-5" />
            </button>
          </div>
        </div>
      </Transition>
    </div>
  </Teleport>
</template>

<style scoped>
.stock-banner-enter-active {
  transition: all 0.34s cubic-bezier(0.22, 1, 0.36, 1);
}
.stock-banner-leave-active {
  transition: all 0.22s cubic-bezier(0.4, 0, 1, 1);
}
.stock-banner-enter-from {
  opacity: 0;
  transform: translateY(-24px) scale(0.97);
}
.stock-banner-leave-to {
  opacity: 0;
  transform: translateY(-16px) scale(0.97);
}
</style>
