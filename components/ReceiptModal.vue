<script setup lang="ts">
import { formatPaymentMethodLabel, isDriverFoodPayment, type ReceiptData } from '~/types/pos'
import { formatDateTimeWib, formatRupiah } from '~/utils/format'

const props = defineProps<{
  modelValue: boolean
  receipt: ReceiptData | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const config = useRuntimeConfig()
const paperWidth = ref<'58mm' | '80mm'>('58mm')

const isOpen = computed({
  get: () => props.modelValue,
  set: (val: boolean) => emit('update:modelValue', val)
})

function handlePrint() {
  if (import.meta.client) {
    window.print()
  }
}

function closeModal() {
  isOpen.value = false
}
</script>

<template>
  <UModal v-model="isOpen" :ui="{ width: 'sm:max-w-md' }">
    <div v-if="receipt" class="overflow-hidden rounded-2xl bg-white text-[#0f213d] dark:bg-[#111d33] dark:text-slate-100">
      <!-- Top Bar (Non-print) -->
      <div class="flex items-center justify-between border-b border-slate-200 bg-[#0f213d] px-5 py-3.5 text-white dark:border-slate-800">
        <div class="flex items-center gap-2">
          <UIcon name="i-heroicons-check-circle" class="h-5 w-5 text-teal-400" />
          <h3 class="text-sm font-bold">
            Struk Pembayaran &amp; Dapur
          </h3>
        </div>
        <div class="flex items-center gap-1 rounded-lg bg-white/10 p-1 text-xs">
          <button
            type="button"
            class="rounded-md px-2.5 py-1 font-semibold transition-colors"
            :class="paperWidth === '58mm' ? 'bg-[#0d9488] text-white' : 'text-slate-300 hover:text-white'"
            @click="paperWidth = '58mm'"
          >
            58mm
          </button>
          <button
            type="button"
            class="rounded-md px-2.5 py-1 font-semibold transition-colors"
            :class="paperWidth === '80mm' ? 'bg-[#0d9488] text-white' : 'text-slate-300 hover:text-white'"
            @click="paperWidth = '80mm'"
          >
            80mm
          </button>
        </div>
      </div>

      <!-- Thermal Receipt Preview & Print Area -->
      <div class="flex justify-center bg-slate-100 p-5 dark:bg-[#0b1424]">
        <div
          id="thermal-receipt-print-area"
          class="rounded-xl border border-dashed border-slate-300 bg-white p-4 font-mono text-xs leading-relaxed text-slate-900 shadow-sm"
          :class="paperWidth === '58mm' ? 'paper-58mm w-[240px]' : 'paper-80mm w-[310px]'"
        >
          <!-- Store Header -->
          <div class="text-center">
            <p class="text-sm font-extrabold uppercase tracking-wide">
              {{ config.public.storeName }}
            </p>
            <p class="text-[10px] text-slate-600">
              Dimsum Fresh Kukus &amp; Goreng Setiap Hari
            </p>
          </div>

          <div class="my-2.5 border-t border-dashed border-slate-400" />

          <!-- Order Type Highlight (Takeaway Only / Driver Food) -->
          <div class="rounded border border-slate-900 px-2 py-1 text-center font-bold uppercase">
            {{ isDriverFoodPayment(receipt.metode_pembayaran) ? `DRIVER ${receipt.metode_pembayaran.toUpperCase()} · TAKEAWAY` : 'TAKEAWAY (BUNGKUS)' }}
          </div>

          <!-- Meta Info -->
          <div class="mt-2.5 space-y-0.5 text-[11px]">
            <div class="flex justify-between gap-2">
              <span class="text-slate-600">Faktur</span>
              <span class="font-bold tabular-nums">{{ receipt.no_faktur }}</span>
            </div>
            <div v-if="receipt.kode_order_driver" class="flex justify-between gap-2">
              <span class="text-slate-600">Order Driver</span>
              <span class="font-bold">{{ receipt.kode_order_driver }}</span>
            </div>
            <div class="flex justify-between gap-2">
              <span class="text-slate-600">Waktu</span>
              <span class="tabular-nums">{{ formatDateTimeWib(receipt.tanggal_transaksi) }}</span>
            </div>
            <div class="flex justify-between gap-2">
              <span class="text-slate-600">Kasir</span>
              <span>{{ receipt.kasir.nama }}</span>
            </div>
          </div>

          <div class="my-2.5 border-t border-dashed border-slate-400" />

          <!-- Items List -->
          <div class="space-y-2">
            <div v-for="(item, index) in receipt.items" :key="`${item.id_produk}-${index}`">
              <div class="flex justify-between gap-2 font-bold">
                <span class="break-words">{{ item.nama_menu }}</span>
                <span class="shrink-0 tabular-nums">{{ formatRupiah(item.subtotal) }}</span>
              </div>
              <div class="flex justify-between text-[11px] text-slate-600 tabular-nums">
                <span>{{ item.qty }} {{ item.satuan }} x {{ formatRupiah(item.harga_satuan) }}</span>
              </div>
              <div
                v-if="item.catatan"
                class="mt-0.5 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold italic text-slate-800"
              >
                Catatan Dapur: {{ item.catatan }}
              </div>
            </div>
          </div>

          <div class="my-2.5 border-t border-dashed border-slate-400" />

          <!-- Payment Summary -->
          <div class="space-y-1 text-[11px]">
            <div class="flex justify-between text-xs font-extrabold">
              <span>GRAND TOTAL</span>
              <span class="tabular-nums">{{ formatRupiah(receipt.total_harga) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-600">Metode Bayar</span>
              <span class="font-bold">{{ formatPaymentMethodLabel(receipt.metode_pembayaran) }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-slate-600">Dibayar</span>
              <span class="tabular-nums">{{ formatRupiah(receipt.bayar) }}</span>
            </div>
            <div class="flex justify-between font-bold">
              <span>Kembalian</span>
              <span class="tabular-nums">{{ formatRupiah(receipt.kembalian) }}</span>
            </div>
          </div>

          <div class="my-2.5 border-t border-dashed border-slate-400" />

          <div class="text-center text-[10px] text-slate-600">
            <p class="font-bold text-slate-800">Terima kasih atas pesanan Anda!</p>
            <p>Selamat menikmati dimsum hangat kami.</p>
          </div>
        </div>
      </div>

      <!-- Footer Actions (Non-print) -->
      <div class="flex items-center justify-end gap-2.5 border-t border-slate-200 bg-white px-5 py-3.5 dark:border-slate-800 dark:bg-[#0b1424]">
        <button
          type="button"
          class="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-[#15243d] dark:text-slate-200 dark:hover:bg-slate-800"
          @click="closeModal"
        >
          Transaksi Baru
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-lg bg-[#0d9488] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#0b7a71]"
          @click="handlePrint"
        >
          <UIcon name="i-heroicons-printer" class="h-4 w-4" />
          <span>Cetak Struk ({{ paperWidth }})</span>
        </button>
      </div>
    </div>
  </UModal>
</template>
