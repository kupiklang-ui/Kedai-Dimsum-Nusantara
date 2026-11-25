<script setup lang="ts">
import type { StockRequestItem, StockRequestsResponse } from '~/types/pos'

const emit = defineEmits<{
  stockReceived: []
  statusUpdated: [payload: StockRequestsResponse]
}>()

const toast = useToast()

const sentRequests = ref<StockRequestItem[]>([])
const currentDimsumPcs = ref<number>(0)
const confirming = ref(false)
const soundEnabled = ref(true)

let pollTimer: ReturnType<typeof setInterval> | null = null
let inFlight = false
let hasFetchedOnce = false

function playSupplyChime() {
  if (!import.meta.client) return
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const now = ctx.currentTime
    const notes = [523.25, 659.25, 783.99, 1046.5] // Uplifting C-major chime
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now + idx * 0.08)
      gain.gain.setValueAtTime(0.001, now + idx * 0.08)
      gain.gain.exponentialRampToValueAtTime(0.12, now + idx * 0.08 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 0.26)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + idx * 0.08)
      osc.stop(now + idx * 0.08 + 0.28)
    })
    setTimeout(() => ctx.close().catch(() => {}), 900)
  } catch {
    // Ignore autoplay block
  }
}

const totalSentPcs = computed(() =>
  sentRequests.value.reduce((sum, r) => sum + (r.qty_dikirim ?? r.qty_diminta), 0)
)

const latestSent = computed(() => sentRequests.value[0] || null)

async function pollSupplyStatus() {
  if (!import.meta.client || inFlight) return
  inFlight = true
  try {
    const res = await $fetch<StockRequestsResponse>('/api/stock-requests')
    currentDimsumPcs.value = res.currentDimsumPcs
    emit('statusUpdated', res)

    const incomingSent = res.requests.filter(r => r.status === 'Dikirim ke Kasir')
    const prevIds = new Set(sentRequests.value.map(r => r.id_request))
    const hasBrandNew = incomingSent.some(r => !prevIds.has(r.id_request))

    sentRequests.value = incomingSent

    if (hasBrandNew) {
      // Langsung sinkronkan stok di layar POS meskipun kasir belum klik tombol konfirmasi
      emit('stockReceived')
      if (soundEnabled.value && hasFetchedOnce) {
        playSupplyChime()
      }
    }
    hasFetchedOnce = true
  } catch {
    // Ignore transient network errors
  } finally {
    inFlight = false
  }
}

async function handleConfirmReceived() {
  if (sentRequests.value.length === 0 || confirming.value) return
  confirming.value = true
  const toConfirm = [...sentRequests.value]
  try {
    await Promise.all(
      toConfirm.map(req =>
        $fetch(`/api/stock-requests/${req.id_request}`, {
          method: 'PATCH',
          body: { action: 'confirm_received' }
        })
      )
    )
    sentRequests.value = []
    emit('stockReceived')
    toast.add({
      title: 'Stok Dimsum Diperbarui!',
      description: `Pasokan +${toConfirm.reduce((s, r) => s + (r.qty_dikirim ?? r.qty_diminta), 0)} pcs telah diterima. Menu siap dijual kembali!`,
      color: 'green',
      icon: 'i-heroicons-check-circle'
    })
    await pollSupplyStatus()
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string }, message?: string }
    toast.add({
      title: 'Gagal Mengonfirmasi',
      description: fetchErr?.data?.statusMessage || fetchErr?.message || 'Coba lagi.',
      color: 'red',
      icon: 'i-heroicons-exclamation-triangle'
    })
  } finally {
    confirming.value = false
  }
}

defineExpose({
  refresh: pollSupplyStatus
})

onMounted(() => {
  pollSupplyStatus()
  pollTimer = setInterval(pollSupplyStatus, 5000)
})

onBeforeUnmount(() => {
  if (pollTimer) clearInterval(pollTimer)
})
</script>

<template>
  <Teleport to="body">
    <div
      class="pointer-events-none fixed inset-x-0 top-3 z-[75] flex justify-center px-3 sm:top-4 sm:px-4"
      aria-live="polite"
    >
      <Transition name="supply-banner">
        <div
          v-if="sentRequests.length > 0 && latestSent"
          class="pointer-events-auto relative w-full max-w-2xl overflow-hidden rounded-2xl border border-teal-200/90 border-l-[5px] border-l-[#0d9488] bg-white p-4 text-[#0f213d] shadow-[0_16px_42px_rgba(15,33,61,0.2)] dark:border-teal-500/40 dark:border-l-[#14b8a6] dark:bg-[#111d33] dark:text-white dark:shadow-[0_18px_48px_rgba(0,0,0,0.65)] sm:p-5"
        >
          <div class="flex items-start gap-3.5">
            <!-- Teal Supply Icon Box -->
            <div class="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#0d9488] text-white shadow-sm">
              <span class="absolute -right-1 -top-1 flex h-3.5 w-3.5">
                <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-300 opacity-75" />
                <span class="relative inline-flex h-3.5 w-3.5 rounded-full bg-emerald-400 ring-2 ring-white dark:ring-[#111d33]" />
              </span>
              <UIcon name="i-heroicons-archive-box-arrow-down" class="h-6 w-6" />
            </div>

            <div class="min-w-0 flex-1 pr-6">
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="text-sm font-extrabold tracking-tight text-[#0f213d] dark:text-white sm:text-base">
                  Pasokan Dimsum Sudah Dikirim ke Kasir!
                </h3>
                <span class="rounded-full bg-teal-50 px-2.5 py-0.5 text-[11px] font-bold text-[#0d9488] ring-1 ring-teal-200 dark:bg-teal-950/70 dark:text-teal-300 dark:ring-teal-500/30">
                  +{{ totalSentPcs }} Pcs Ditambahkan
                </span>
              </div>

              <p class="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300 sm:text-[13px]">
                <strong>{{ latestSent.admin_nama || 'Admin' }}</strong> selesai memproduksi &amp; mengirim
                <strong class="text-[#0d9488] dark:text-teal-300">+{{ totalSentPcs }} Pcs</strong> dimsum
                (total stok live: <strong>{{ currentDimsumPcs }} pcs</strong>).
                <span v-if="latestSent.catatan_admin"> "{{ latestSent.catatan_admin }}"</span>
              </p>

              <div class="mt-3.5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  :disabled="confirming"
                  class="inline-flex items-center gap-2 rounded-lg bg-[#0d6e66] px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-[#095750] active:scale-[0.98] disabled:opacity-60"
                  @click="handleConfirmReceived"
                >
                  <UIcon
                    :name="confirming ? 'i-heroicons-arrow-path' : 'i-heroicons-check-badge'"
                    class="h-4 w-4"
                    :class="{ 'animate-spin': confirming }"
                  />
                  <span>{{ confirming ? 'Memperbarui...' : 'Terima & Perbarui Stok Kasir' }}</span>
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
          </div>
        </div>
      </Transition>
    </div>
  </Teleport>
</template>

<style scoped>
.supply-banner-enter-active {
  transition: all 0.34s cubic-bezier(0.22, 1, 0.36, 1);
}
.supply-banner-leave-active {
  transition: all 0.22s cubic-bezier(0.4, 0, 1, 1);
}
.supply-banner-enter-from {
  opacity: 0;
  transform: translateY(-24px) scale(0.97);
}
.supply-banner-leave-to {
  opacity: 0;
  transform: translateY(-16px) scale(0.97);
}
</style>
