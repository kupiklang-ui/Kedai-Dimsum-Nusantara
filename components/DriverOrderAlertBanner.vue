<script setup lang="ts">
import type { DriverOrderItem } from '~/types/pos'

const emit = defineEmits<{
  acceptAndPrint: [orders: DriverOrderItem[]]
  openQueue: []
}>()

const {
  visibleOrders,
  soundEnabled,
  acknowledgeAll,
  startListening,
  stopListening
} = useDriverOrderAlerts()

const hasDemoInBatch = computed(() =>
  visibleOrders.value.some(o => o.kode_order_driver?.includes('(Demo)'))
)

function extractShortCode(order: DriverOrderItem): string {
  if (order.kode_order_driver) {
    const cleaned = order.kode_order_driver
      .replace(/\(Demo\)/gi, '')
      .split('·')[0]
      .trim()
    if (cleaned) return cleaned
  }
  const suffix = order.no_faktur.split('-').pop() || order.no_faktur
  return order.metode_pembayaran === 'ShopeeFood' ? `#SF-${suffix}` : `#GF-${suffix}`
}

const summaryLine = computed(() => {
  const shopee = visibleOrders.value.filter(o => o.metode_pembayaran === 'ShopeeFood')
  const gofood = visibleOrders.value.filter(o => o.metode_pembayaran === 'GoFood')

  const parts: string[] = []
  if (shopee.length > 0) {
    const codes = shopee.slice(0, 2).map(extractShortCode).join(', ')
    const extra = shopee.length > 2 ? ', ...' : ''
    parts.push(`${shopee.length} ShopeeFood (${codes}${extra})`)
  }
  if (gofood.length > 0) {
    const codes = gofood.slice(0, 2).map(extractShortCode).join(', ')
    const extra = gofood.length > 2 ? ', ...' : ''
    parts.push(`${gofood.length} GoFood (${codes}${extra})`)
  }

  return `${parts.join(', ')} - Siap Diproses Dapur & Driver`
})

function handleAcceptAll() {
  const snapshot = [...visibleOrders.value]
  acknowledgeAll()
  emit('acceptAndPrint', snapshot)
}

function handleDismiss() {
  acknowledgeAll()
}

onMounted(() => {
  startListening()
})

onBeforeUnmount(() => {
  stopListening()
})
</script>

<template>
  <Teleport to="body">
    <div
      class="pointer-events-none fixed inset-x-0 top-3 z-[70] flex justify-center px-3 sm:top-4 sm:px-4"
      aria-live="polite"
    >
      <Transition name="online-order-pop">
        <div
          v-if="visibleOrders.length > 0"
          class="pointer-events-auto relative w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200/90 border-l-[5px] border-l-[#0f6b63] bg-white p-4 text-[#0f213d] shadow-[0_14px_40px_rgba(15,33,61,0.18)] dark:border-slate-700 dark:border-l-[#14b8a6] dark:bg-[#111d33] dark:text-white dark:shadow-[0_18px_45px_rgba(0,0,0,0.6)] sm:p-5"
        >
          <div class="flex items-start gap-3.5">
            <!-- Warm Coral-Red Bell Icon Box with Notification Dot (Matches Reference) -->
            <div class="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#c94538] text-white shadow-sm">
              <span class="absolute -right-1 -top-1 flex h-3.5 w-3.5">
                <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                <span class="relative inline-flex h-3.5 w-3.5 rounded-full bg-[#9e2118] ring-2 ring-white dark:ring-[#111d33]" />
              </span>
              <UIcon name="i-heroicons-bell-alert" class="h-6 w-6" />
            </div>

            <!-- Main Content -->
            <div class="min-w-0 flex-1 pr-6">
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="text-sm font-extrabold tracking-tight text-[#0f213d] dark:text-white sm:text-base">
                  {{ visibleOrders.length }} Pesanan Online Menunggu
                </h3>
                <span class="rounded-full bg-[#fde4e2] px-2.5 py-0.5 text-[11px] font-bold text-[#b83227] dark:bg-rose-950/70 dark:text-rose-300">
                  Perlu Konfirmasi
                </span>
                <span
                  v-if="hasDemoInBatch"
                  class="rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-[#0d9488] dark:bg-teal-950/70 dark:text-teal-300"
                >
                  Demo
                </span>
              </div>

              <p class="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300 sm:text-[13px]">
                {{ summaryLine }}
              </p>

              <!-- Primary Action Row (Matches Reference Deep Teal CTA) -->
              <div class="mt-3.5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  class="inline-flex items-center gap-2 rounded-lg bg-[#0d6e66] px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-[#095750] active:scale-[0.98] sm:text-[13px]"
                  @click="handleAcceptAll"
                >
                  <UIcon name="i-heroicons-check-badge" class="h-4 w-4 shrink-0" />
                  <span>Terima Semua &amp; Cetak Tiket Dapur</span>
                </button>

                <button
                  type="button"
                  class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:border-[#0d9488] hover:text-[#0d9488] dark:border-slate-700 dark:bg-[#0b1424] dark:text-slate-200"
                  @click="emit('openQueue')"
                >
                  <UIcon name="i-heroicons-list-bullet" class="h-4 w-4" />
                  <span>Lihat Antrean</span>
                </button>

                <button
                  type="button"
                  class="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:bg-[#0b1424] dark:text-slate-300"
                  :title="soundEnabled ? 'Matikan suara bel' : 'Nyalakan suara bel'"
                  @click="soundEnabled = !soundEnabled"
                >
                  <UIcon
                    :name="soundEnabled ? 'i-heroicons-speaker-wave' : 'i-heroicons-speaker-x-mark'"
                    class="h-4 w-4"
                  />
                </button>
              </div>
            </div>

            <!-- Close Button -->
            <button
              type="button"
              class="absolute right-3 top-3 rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
              aria-label="Tutup notifikasi"
              @click="handleDismiss"
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
.online-order-pop-enter-active {
  transition: all 0.34s cubic-bezier(0.22, 1, 0.36, 1);
}

.online-order-pop-leave-active {
  transition: all 0.22s cubic-bezier(0.4, 0, 1, 1);
}

.online-order-pop-enter-from {
  opacity: 0;
  transform: translateY(-24px) scale(0.97);
}

.online-order-pop-leave-to {
  opacity: 0;
  transform: translateY(-16px) scale(0.97);
}
</style>
