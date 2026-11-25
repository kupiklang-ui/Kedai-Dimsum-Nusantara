<script setup lang="ts">
import type {
  CashierShiftItem,
  CloseShiftResponse,
  CurrentShiftResponse
} from '~/types/pos'
import { formatDateTimeWib, formatRupiah } from '~/utils/format'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'logout-requested': []
}>()

const config = useRuntimeConfig()
const toast = useToast()

const isOpen = computed({
  get: () => props.modelValue,
  set: (val: boolean) => emit('update:modelValue', val)
})

const loading = ref(false)
const submitting = ref(false)
const openingShift = ref(false)

const activeTab = ref<'close' | 'open'>('close')
const viewMode = ref<'form' | 'summary'>('form')
const showDenomCalc = ref(false)
const paperWidth = ref<'58mm' | '80mm'>('58mm')

const currentData = ref<CurrentShiftResponse | null>(null)
const modalAwalInput = ref<number>(0)
const uangFisikInput = ref<number | null>(null)
const catatanInput = ref('')

const closedShiftResult = ref<CashierShiftItem | null>(null)
const closingWaUrl = ref<string | null>(null)

const modalPresets = [0, 50000, 100000, 200000, 300000]

const denominations = reactive<Array<{ label: string, value: number, count: number }>>([
  { label: 'Rp 100.000', value: 100000, count: 0 },
  { label: 'Rp 50.000', value: 50000, count: 0 },
  { label: 'Rp 20.000', value: 20000, count: 0 },
  { label: 'Rp 10.000', value: 10000, count: 0 },
  { label: 'Rp 5.000', value: 5000, count: 0 },
  { label: 'Rp 2.000', value: 2000, count: 0 },
  { label: 'Rp 1.000', value: 1000, count: 0 },
  { label: 'Rp 500', value: 500, count: 0 }
])

const denomTotal = computed(() =>
  denominations.reduce((sum, d) => sum + (Math.max(0, Math.floor(Number(d.count) || 0)) * d.value), 0)
)

function applyDenomTotal() {
  uangFisikInput.value = denomTotal.value
}

function resetDenoms() {
  for (const d of denominations) {
    d.count = 0
  }
}

watch(denomTotal, (val) => {
  if (showDenomCalc.value) {
    uangFisikInput.value = val
  }
})

async function fetchCurrentShift() {
  loading.value = true
  try {
    const res = await $fetch<CurrentShiftResponse>('/api/shifts/current')
    currentData.value = res
    modalAwalInput.value = res.activeShift.modal_awal
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string }, message?: string }
    toast.add({
      title: 'Gagal Memuat Data Shift',
      description: fetchErr?.data?.statusMessage || fetchErr?.message || 'Coba lagi.',
      color: 'red',
      icon: 'i-heroicons-exclamation-triangle'
    })
  } finally {
    loading.value = false
  }
}

watch(() => props.modelValue, (opened) => {
  if (opened) {
    viewMode.value = 'form'
    activeTab.value = 'close'
    uangFisikInput.value = null
    catatanInput.value = ''
    showDenomCalc.value = false
    resetDenoms()
    closedShiftResult.value = null
    closingWaUrl.value = null
    fetchCurrentShift()
  }
})

async function handleOpenShift() {
  const modalVal = Math.max(0, Number(modalAwalInput.value) || 0)
  openingShift.value = true
  try {
    const res = await $fetch<{ success: boolean, message: string }>('/api/shifts/open', {
      method: 'POST',
      body: { modal_awal: modalVal }
    })

    toast.add({
      title: 'Shift Kasir Aktif',
      description: res.message,
      color: 'green',
      icon: 'i-heroicons-check-circle'
    })

    await fetchCurrentShift()
    activeTab.value = 'close'
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string }, message?: string }
    toast.add({
      title: 'Gagal Membuka Shift',
      description: fetchErr?.data?.statusMessage || fetchErr?.message || 'Coba lagi.',
      color: 'red',
      icon: 'i-heroicons-exclamation-triangle'
    })
  } finally {
    openingShift.value = false
  }
}

async function handleCloseShift() {
  if (uangFisikInput.value === null || uangFisikInput.value === undefined || !Number.isFinite(Number(uangFisikInput.value)) || Number(uangFisikInput.value) < 0) {
    toast.add({
      title: 'Uang Fisik Laci Wajib Diisi',
      description: 'Hitung dan masukkan jumlah uang tunai fisik yang ada di laci kasir.',
      color: 'amber',
      icon: 'i-heroicons-exclamation-triangle'
    })
    return
  }

  submitting.value = true
  try {
    const res = await $fetch<CloseShiftResponse>('/api/shifts/close', {
      method: 'POST',
      body: {
        uang_fisik_laci: Number(uangFisikInput.value),
        modal_awal: Math.max(0, Number(modalAwalInput.value) || 0),
        catatan: catatanInput.value.trim() || null
      }
    })

    closedShiftResult.value = res.shift
    closingWaUrl.value = res.whatsapp.waUrl
    viewMode.value = 'summary'

    const selisih = res.shift.selisih_kas ?? 0
    toast.add({
      title: selisih === 0 ? 'Tutup Kasir Selesai — Kas PAS!' : 'Tutup Kasir Tersimpan',
      description: res.message,
      color: selisih === 0 ? 'green' : selisih > 0 ? 'blue' : 'amber',
      icon: selisih === 0 ? 'i-heroicons-check-circle' : 'i-heroicons-exclamation-triangle'
    })

    await fetchCurrentShift()
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string }, message?: string }
    toast.add({
      title: 'Gagal Menutup Shift',
      description: fetchErr?.data?.statusMessage || fetchErr?.message || 'Coba lagi.',
      color: 'red',
      icon: 'i-heroicons-exclamation-triangle'
    })
  } finally {
    submitting.value = false
  }
}

function viewHistoryShift(shift: CashierShiftItem) {
  closedShiftResult.value = shift
  closingWaUrl.value = null
  viewMode.value = 'summary'
}

function printClosingSlip() {
  const shift = closedShiftResult.value
  if (!shift) return

  const widthCss = paperWidth.value === '80mm' ? '80mm' : '58mm'
  const selisih = shift.selisih_kas ?? 0
  const selisihText = selisih === 0
    ? 'PAS (Rp 0)'
    : selisih > 0
      ? `LEBIH +${formatRupiah(selisih)}`
      : `KURANG -${formatRupiah(Math.abs(selisih))}`

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8" />
<title>Struk Closing Shift #${shift.id_shift}</title>
<style>
  @page { size: ${widthCss} auto; margin: 2mm; }
  body { font-family: 'Courier New', monospace; font-size: 11px; color: #000; width: ${widthCss}; margin: 0 auto; padding: 4px; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .line { border-top: 1px dashed #000; margin: 6px 0; }
  .row { display: flex; justify-content: space-between; gap: 6px; margin: 2px 0; }
  .small { font-size: 10px; }
</style>
</head>
<body>
  <div class="center bold" style="font-size:13px;">${config.public.storeName}</div>
  <div class="center small">STRUK TUTUP KASIR (CLOSING)</div>
  <div class="line"></div>
  <div class="row"><span>Shift</span><span class="bold">#${shift.id_shift}</span></div>
  <div class="row"><span>Kasir</span><span>${shift.kasir_nama}</span></div>
  <div class="row small"><span>Buka</span><span>${formatDateTimeWib(shift.waktu_buka)}</span></div>
  <div class="row small"><span>Tutup</span><span>${shift.waktu_tutup ? formatDateTimeWib(shift.waktu_tutup) : '-'}</span></div>
  <div class="row"><span>Jml Order</span><span class="bold">${shift.total_transaksi} transaksi</span></div>
  <div class="line"></div>
  <div class="bold">REKAP LACI TUNAI</div>
  <div class="row"><span>Modal Awal</span><span>${formatRupiah(shift.modal_awal)}</span></div>
  <div class="row"><span>Penjualan Tunai</span><span>${formatRupiah(shift.total_tunai_sistem)}</span></div>
  <div class="row bold"><span>Target Kas Laci</span><span>${formatRupiah(shift.ekspektasi_kas_laci)}</span></div>
  <div class="row bold"><span>Uang Fisik Laci</span><span>${formatRupiah(shift.uang_fisik_laci ?? 0)}</span></div>
  <div class="row bold"><span>Selisih Kas</span><span>${selisihText}</span></div>
  <div class="line"></div>
  <div class="bold">NON-TUNAI & OMZET</div>
  <div class="row"><span>QRIS</span><span>${formatRupiah(shift.total_qris_sistem)}</span></div>
  <div class="row"><span>ShopeeFood</span><span>${formatRupiah(shift.total_shopeefood_sistem)}</span></div>
  <div class="row"><span>GoFood</span><span>${formatRupiah(shift.total_gofood_sistem)}</span></div>
  <div class="line"></div>
  <div class="row bold" style="font-size:12px;"><span>TOTAL OMZET</span><span>${formatRupiah(shift.total_omzet)}</span></div>
  ${shift.catatan ? `<div class="line"></div><div class="small">Catatan: ${shift.catatan}</div>` : ''}
  <div class="line"></div>
  <div class="center small">Dicetak otomatis oleh Sistem POS</div>
</body>
</html>`

  const win = window.open('', '_blank', 'width=360,height=640')
  if (!win) {
    toast.add({
      title: 'Pop-up Cetak Diblokir',
      description: 'Izinkan pop-up browser untuk mencetak struk closing.',
      color: 'amber',
      icon: 'i-heroicons-exclamation-triangle'
    })
    return
  }
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => {
    win.print()
    win.close()
  }, 250)
}
</script>

<template>
  <UModal v-model="isOpen" :ui="{ width: 'sm:max-w-xl' }">
    <div class="overflow-hidden rounded-2xl bg-white text-[#0f213d] dark:bg-[#111d33] dark:text-slate-100">
      <!-- Header -->
      <div class="flex items-center justify-between border-b border-slate-200 bg-[#0f213d] px-5 py-4 text-white dark:border-slate-800">
        <div class="flex items-center gap-2.5">
          <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0d9488] text-white">
            <UIcon name="i-heroicons-banknotes" class="h-5 w-5" />
          </div>
          <div>
            <h3 class="text-sm font-bold">Tutup Kasir &amp; Rekap Laci (Closing)</h3>
            <p class="text-[11px] text-teal-200/85">
              Cocokkan uang tunai fisik di laci dengan penjualan tunai sistem
            </p>
          </div>
        </div>
        <button
          type="button"
          class="rounded-lg p-1 text-slate-300 hover:bg-white/10 hover:text-white"
          @click="isOpen = false"
        >
          <UIcon name="i-heroicons-x-mark" class="h-5 w-5" />
        </button>
      </div>

      <div v-if="loading && !currentData" class="flex items-center justify-center py-14 text-xs text-slate-400">
        Memuat data shift kasir...
      </div>

      <!-- VIEW 1: FORM BUKA SHIFT / TUTUP KASIR (BLIND CLOSING) -->
      <div v-else-if="viewMode === 'form'" class="max-h-[80vh] overflow-y-auto p-5">
        <!-- Mode Tabs -->
        <div class="mb-4 grid grid-cols-2 rounded-xl border border-slate-200 bg-slate-100/80 p-1 dark:border-slate-700 dark:bg-[#0b1424]">
          <button
            type="button"
            class="rounded-lg py-2 text-xs font-bold transition-colors"
            :class="activeTab === 'close' ? 'bg-[#0f213d] text-white shadow-sm dark:bg-[#0d9488]' : 'text-slate-600 hover:text-[#0f213d] dark:text-slate-300'"
            @click="activeTab = 'close'"
          >
            Tutup Kasir (Closing)
          </button>
          <button
            type="button"
            class="rounded-lg py-2 text-xs font-bold transition-colors"
            :class="activeTab === 'open' ? 'bg-[#0f213d] text-white shadow-sm dark:bg-[#0d9488]' : 'text-slate-600 hover:text-[#0f213d] dark:text-slate-300'"
            @click="activeTab = 'open'"
          >
            {{ currentData?.hasOpenShift ? 'Atur Modal Awal Shift' : 'Buka Shift (Modal Awal)' }}
          </button>
        </div>

        <!-- TAB A: BUKA SHIFT / MODAL AWAL -->
        <form v-if="activeTab === 'open'" class="space-y-4" @submit.prevent="handleOpenShift">
          <div class="rounded-xl border border-teal-200/80 bg-teal-50/60 p-3.5 text-xs dark:border-teal-500/30 dark:bg-teal-950/30">
            <p class="font-bold text-[#0f213d] dark:text-teal-200">
              {{ currentData?.hasOpenShift ? 'Shift Sedang Berjalan' : 'Catat Modal Awal Laci (Opsional)' }}
            </p>
            <p class="mt-0.5 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
              Masukkan jumlah uang receh / modal kembalian yang diletakkan di laci saat mulai jaga. Isi <strong>Rp 0</strong> jika tidak memakai modal awal.
            </p>
          </div>

          <div>
            <label class="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Modal Awal Laci (Rp)
            </label>
            <input
              v-model.number="modalAwalInput"
              type="number"
              inputmode="numeric"
              min="0"
              step="500"
              class="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-base font-extrabold text-[#0f213d] tabular-nums focus:border-[#0d9488] focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-[#0b1424] dark:text-white"
            >
            <div class="mt-2 flex flex-wrap gap-1.5">
              <button
                v-for="preset in modalPresets"
                :key="preset"
                type="button"
                class="rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors tabular-nums"
                :class="modalAwalInput === preset ? 'border-[#0d9488] bg-[#0d9488] text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-[#0d9488] dark:border-slate-700 dark:bg-[#0b1424] dark:text-slate-300'"
                @click="modalAwalInput = preset"
              >
                {{ formatRupiah(preset) }}
              </button>
            </div>
          </div>

          <div class="flex justify-end gap-2 border-t border-slate-200 pt-3.5 dark:border-slate-800">
            <button
              type="button"
              class="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-[#0b1424] dark:text-slate-300"
              @click="isOpen = false"
            >
              Tutup
            </button>
            <button
              type="submit"
              :disabled="openingShift"
              class="inline-flex items-center gap-1.5 rounded-lg bg-[#0d9488] px-4 py-2 text-xs font-bold text-white hover:bg-[#0b7a71] disabled:opacity-60"
            >
              <UIcon :name="openingShift ? 'i-heroicons-arrow-path' : 'i-heroicons-play'" class="h-4 w-4" :class="{ 'animate-spin': openingShift }" />
              <span>{{ currentData?.hasOpenShift ? 'Perbarui Modal Awal' : 'Simpan & Buka Shift' }}</span>
            </button>
          </div>
        </form>

        <!-- TAB B: TUTUP KASIR (BLIND CLOSING) -->
        <form v-else class="space-y-4" @submit.prevent="handleCloseShift">
          <!-- Shift Activity Overview (Blind Closing: Tunai target hidden until submitted!) -->
          <div class="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <div class="rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-[#0b1424]">
              <p class="text-[10px] font-semibold uppercase text-slate-400">Mulai Shift</p>
              <p class="mt-0.5 text-xs font-bold text-[#0f213d] dark:text-white">
                {{ currentData ? formatDateTimeWib(currentData.activeShift.waktu_buka) : '-' }}
              </p>
            </div>
            <div class="rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-[#0b1424]">
              <p class="text-[10px] font-semibold uppercase text-slate-400">Transaksi Shift</p>
              <p class="mt-0.5 text-sm font-extrabold text-[#0f213d] tabular-nums dark:text-white">
                {{ currentData?.activeShift.total_transaksi ?? 0 }} Order
              </p>
            </div>
            <div class="col-span-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-[#0b1424] sm:col-span-1">
              <p class="text-[10px] font-semibold uppercase text-slate-400">Non-Tunai (QRIS/Driver)</p>
              <p class="mt-0.5 text-sm font-extrabold text-[#0d9488] tabular-nums dark:text-teal-300">
                {{ formatRupiah(currentData?.activeShift.total_non_tunai ?? 0) }}
              </p>
            </div>
          </div>

          <!-- Blind Closing Notice -->
          <div class="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/80 px-3.5 py-2.5 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/35 dark:text-amber-200">
            <UIcon name="i-heroicons-eye-slash" class="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
            <p class="text-[11px] leading-relaxed">
              <strong>Mode Blind Closing Aktif:</strong> Target uang tunai sistem disembunyikan sementara agar Anda menghitung uang fisik di laci secara akurat. Hasil pencocokan &amp; selisih otomatis muncul setelah Anda menekan <strong>Konfirmasi &amp; Tutup Kasir</strong>.
            </p>
          </div>

          <!-- Modal Awal Laci -->
          <div>
            <div class="mb-1 flex items-center justify-between">
              <label class="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Modal Awal Laci (Uang Kembalian Awal)
              </label>
              <div class="flex gap-1">
                <button
                  v-for="preset in [0, 50000, 100000, 200000]"
                  :key="`m-${preset}`"
                  type="button"
                  class="rounded border px-1.5 py-0.5 text-[10px] font-semibold tabular-nums"
                  :class="modalAwalInput === preset ? 'border-[#0d9488] bg-[#0d9488] text-white' : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-[#0b1424] dark:text-slate-300'"
                  @click="modalAwalInput = preset"
                >
                  {{ preset === 0 ? 'Rp 0' : `${preset / 1000}rb` }}
                </button>
              </div>
            </div>
            <input
              v-model.number="modalAwalInput"
              type="number"
              inputmode="numeric"
              min="0"
              step="500"
              class="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2 text-sm font-bold text-[#0f213d] tabular-nums focus:border-[#0d9488] focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-[#0b1424] dark:text-white"
            >
          </div>

          <!-- Uang Tunai Fisik di Laci + Kalkulator Pecahan -->
          <div>
            <div class="mb-1.5 flex items-center justify-between gap-2">
              <label class="text-xs font-bold text-[#0f213d] dark:text-white">
                Jumlah Uang Tunai Fisik di Laci (Rp) *
              </label>
              <button
                type="button"
                class="inline-flex items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1 text-[11px] font-bold text-[#0d9488] hover:bg-[#0d9488] hover:text-white dark:border-teal-500/30 dark:bg-teal-950/40 dark:text-teal-300"
                @click="showDenomCalc = !showDenomCalc"
              >
                <UIcon name="i-heroicons-calculator" class="h-3.5 w-3.5" />
                <span>{{ showDenomCalc ? 'Tutup Kalkulator Pecahan' : 'Hitung per Pecahan' }}</span>
              </button>
            </div>

            <input
              v-model.number="uangFisikInput"
              type="number"
              inputmode="numeric"
              min="0"
              step="500"
              required
              placeholder="Masukkan total uang tunai fisik di laci..."
              class="w-full rounded-xl border-2 border-[#0d9488]/50 bg-white px-3.5 py-3 text-lg font-extrabold text-[#0f213d] tabular-nums placeholder-slate-400 focus:border-[#0d9488] focus:outline-none dark:border-teal-500/50 dark:bg-[#0b1424] dark:text-white"
            >

            <!-- Collapsible Kalkulator Pecahan Uang -->
            <div
              v-if="showDenomCalc"
              class="mt-2.5 rounded-xl border border-slate-200 bg-slate-50/90 p-3 dark:border-slate-700 dark:bg-[#0b1424]"
            >
              <div class="mb-2 flex items-center justify-between text-[11px]">
                <span class="font-bold text-[#0f213d] dark:text-white">Masukkan jumlah lembar / koin:</span>
                <button type="button" class="font-semibold text-rose-500 hover:underline" @click="resetDenoms">
                  Reset
                </button>
              </div>
              <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div
                  v-for="d in denominations"
                  :key="d.value"
                  class="rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-[#111d33]"
                >
                  <p class="text-[10px] font-bold text-slate-500 dark:text-slate-400">{{ d.label }}</p>
                  <input
                    v-model.number="d.count"
                    type="number"
                    inputmode="numeric"
                    min="0"
                    class="mt-1 w-full rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-bold text-[#0f213d] tabular-nums focus:border-[#0d9488] focus:outline-none dark:border-slate-600 dark:bg-[#0b1424] dark:text-white"
                  >
                </div>
              </div>
              <div class="mt-2.5 flex items-center justify-between border-t border-slate-200 pt-2 text-xs dark:border-slate-700">
                <span class="font-semibold text-slate-600 dark:text-slate-300">Total Pecahan:</span>
                <div class="flex items-center gap-2">
                  <span class="font-extrabold text-[#0d9488] tabular-nums">{{ formatRupiah(denomTotal) }}</span>
                  <button
                    type="button"
                    class="rounded bg-[#0d9488] px-2 py-0.5 text-[10px] font-bold text-white"
                    @click="applyDenomTotal"
                  >
                    Pakai
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Catatan Shift -->
          <div>
            <label class="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Catatan Closing (Opsional)
            </label>
            <input
              v-model="catatanInput"
              type="text"
              placeholder="cth: Uang receh disisakan Rp 100rb di laci untuk besok..."
              class="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2 text-xs text-[#0f213d] placeholder-slate-400 focus:border-[#0d9488] focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-[#0b1424] dark:text-white"
            >
          </div>

          <!-- Submit Closing Button -->
          <div class="flex items-center justify-end gap-2 border-t border-slate-200 pt-3.5 dark:border-slate-800">
            <button
              type="button"
              class="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-[#0b1424] dark:text-slate-300"
              @click="isOpen = false"
            >
              Batal
            </button>
            <button
              type="submit"
              :disabled="submitting"
              class="inline-flex items-center gap-1.5 rounded-lg bg-[#0d9488] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-[#0b7a71] disabled:opacity-60"
            >
              <UIcon :name="submitting ? 'i-heroicons-arrow-path' : 'i-heroicons-lock-closed'" class="h-4 w-4" :class="{ 'animate-spin': submitting }" />
              <span>{{ submitting ? 'Menghitung & Menutup...' : 'Konfirmasi & Tutup Kasir' }}</span>
            </button>
          </div>

          <!-- Riwayat Closing Terakhir -->
          <div v-if="currentData && currentData.recentClosedShifts.length > 0" class="border-t border-slate-100 pt-3 dark:border-slate-800">
            <p class="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Riwayat Tutup Kasir Terakhir
            </p>
            <div class="space-y-1.5">
              <button
                v-for="s in currentData.recentClosedShifts.slice(0, 3)"
                :key="s.id_shift"
                type="button"
                class="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2 text-left text-xs transition-colors hover:border-teal-300 dark:border-slate-800 dark:bg-[#0b1424]"
                @click="viewHistoryShift(s)"
              >
                <div class="min-w-0">
                  <p class="font-bold text-[#0f213d] dark:text-white">
                    Shift #{{ s.id_shift }} · {{ s.total_transaksi }} order
                  </p>
                  <p class="text-[10px] text-slate-400">
                    Tutup: {{ s.waktu_tutup ? formatDateTimeWib(s.waktu_tutup) : '-' }}
                  </p>
                </div>
                <span
                  class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums"
                  :class="
                    (s.selisih_kas ?? 0) === 0
                      ? 'bg-teal-50 text-[#0d9488] dark:bg-teal-950/60 dark:text-teal-300'
                      : (s.selisih_kas ?? 0) > 0
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                        : 'bg-rose-50 text-[#ee6352] dark:bg-rose-950/60 dark:text-rose-300'
                  "
                >
                  {{
                    (s.selisih_kas ?? 0) === 0
                      ? 'Pas Rp 0'
                      : (s.selisih_kas ?? 0) > 0
                        ? `+${formatRupiah(s.selisih_kas ?? 0)}`
                        : `-${formatRupiah(Math.abs(s.selisih_kas ?? 0))}`
                  }}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>

      <!-- VIEW 2: HASIL REKAP CLOSING + STRUK THERMAL + KIRIM WA -->
      <div v-else-if="closedShiftResult" class="max-h-[82vh] space-y-4 overflow-y-auto p-5">
        <!-- Status Selisih Banner -->
        <div
          class="flex items-center justify-between gap-3 rounded-2xl border p-4"
          :class="
            (closedShiftResult.selisih_kas ?? 0) === 0
              ? 'border-teal-200 bg-teal-50/80 text-teal-900 dark:border-teal-500/40 dark:bg-teal-950/40 dark:text-teal-200'
              : (closedShiftResult.selisih_kas ?? 0) > 0
                ? 'border-blue-200 bg-blue-50/80 text-blue-900 dark:border-blue-500/40 dark:bg-blue-950/40 dark:text-blue-200'
                : 'border-rose-200 bg-rose-50/80 text-rose-900 dark:border-rose-500/40 dark:bg-rose-950/40 dark:text-rose-200'
          "
        >
          <div class="flex items-center gap-3">
            <div
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
              :class="
                (closedShiftResult.selisih_kas ?? 0) === 0
                  ? 'bg-[#0d9488]'
                  : (closedShiftResult.selisih_kas ?? 0) > 0
                    ? 'bg-[#2e86c1]'
                    : 'bg-[#ee6352]'
              "
            >
              <UIcon
                :name="(closedShiftResult.selisih_kas ?? 0) === 0 ? 'i-heroicons-check-badge' : 'i-heroicons-exclamation-triangle'"
                class="h-6 w-6"
              />
            </div>
            <div>
              <p class="text-xs font-bold uppercase tracking-wider opacity-80">
                Hasil Pencocokan Laci (Shift #{{ closedShiftResult.id_shift }})
              </p>
              <p class="text-base font-extrabold tabular-nums">
                {{
                  (closedShiftResult.selisih_kas ?? 0) === 0
                    ? 'KAS LACI PAS (Rp 0)'
                    : (closedShiftResult.selisih_kas ?? 0) > 0
                      ? `SELISIH LEBIH +${formatRupiah(closedShiftResult.selisih_kas ?? 0)}`
                      : `SELISIH KURANG -${formatRupiah(Math.abs(closedShiftResult.selisih_kas ?? 0))}`
                }}
              </p>
            </div>
          </div>

          <div class="flex rounded-lg border border-black/10 bg-white/70 p-0.5 text-[10px] font-bold dark:bg-black/20">
            <button
              type="button"
              class="rounded px-2 py-1"
              :class="paperWidth === '58mm' ? 'bg-[#0f213d] text-white' : 'text-slate-600'"
              @click="paperWidth = '58mm'"
            >
              58mm
            </button>
            <button
              type="button"
              class="rounded px-2 py-1"
              :class="paperWidth === '80mm' ? 'bg-[#0f213d] text-white' : 'text-slate-600'"
              @click="paperWidth = '80mm'"
            >
              80mm
            </button>
          </div>
        </div>

        <!-- Crisp White Thermal Preview Card -->
        <div class="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-800 shadow-sm">
          <div class="flex items-center justify-between border-b border-dashed border-slate-300 pb-2.5">
            <div>
              <p class="font-extrabold text-[#0f213d]">{{ config.public.storeName }}</p>
              <p class="text-[10px] text-slate-500">Kasir: {{ closedShiftResult.kasir_nama }} · {{ closedShiftResult.total_transaksi }} Order</p>
            </div>
            <div class="text-right text-[10px] text-slate-500">
              <p>Buka: {{ formatDateTimeWib(closedShiftResult.waktu_buka) }}</p>
              <p>Tutup: {{ closedShiftResult.waktu_tutup ? formatDateTimeWib(closedShiftResult.waktu_tutup) : '-' }}</p>
            </div>
          </div>

          <div class="mt-3 space-y-1.5 border-b border-dashed border-slate-300 pb-3">
            <p class="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Rekap Kas Laci (Tunai)</p>
            <div class="flex justify-between">
              <span>Modal Awal Laci</span>
              <span class="font-semibold tabular-nums">{{ formatRupiah(closedShiftResult.modal_awal) }}</span>
            </div>
            <div class="flex justify-between">
              <span>Penjualan Tunai (Sistem)</span>
              <span class="font-semibold tabular-nums">{{ formatRupiah(closedShiftResult.total_tunai_sistem) }}</span>
            </div>
            <div class="flex justify-between font-bold text-[#0f213d]">
              <span>Target Kas Laci</span>
              <span class="tabular-nums">{{ formatRupiah(closedShiftResult.ekspektasi_kas_laci) }}</span>
            </div>
            <div class="flex justify-between font-bold text-[#0d9488]">
              <span>Uang Tunai Fisik di Laci</span>
              <span class="tabular-nums">{{ formatRupiah(closedShiftResult.uang_fisik_laci ?? 0) }}</span>
            </div>
          </div>

          <div class="mt-3 space-y-1.5">
            <p class="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Non-Tunai &amp; Total Omzet</p>
            <div class="flex justify-between">
              <span>QRIS</span>
              <span class="font-semibold tabular-nums">{{ formatRupiah(closedShiftResult.total_qris_sistem) }}</span>
            </div>
            <div class="flex justify-between">
              <span>Driver ShopeeFood</span>
              <span class="font-semibold tabular-nums">{{ formatRupiah(closedShiftResult.total_shopeefood_sistem) }}</span>
            </div>
            <div class="flex justify-between">
              <span>Driver GoFood (Gojek)</span>
              <span class="font-semibold tabular-nums">{{ formatRupiah(closedShiftResult.total_gofood_sistem) }}</span>
            </div>
            <div class="flex justify-between border-t border-dashed border-slate-300 pt-2 text-sm font-extrabold text-[#0f213d]">
              <span>TOTAL OMZET SHIFT</span>
              <span class="tabular-nums">{{ formatRupiah(closedShiftResult.total_omzet) }}</span>
            </div>
            <p v-if="closedShiftResult.catatan" class="pt-1 text-[11px] italic text-slate-500">
              Catatan: {{ closedShiftResult.catatan }}
            </p>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3.5 dark:border-slate-800">
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              class="inline-flex items-center gap-1.5 rounded-lg bg-[#0f213d] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#19355f] dark:bg-slate-700"
              @click="printClosingSlip"
            >
              <UIcon name="i-heroicons-printer" class="h-4 w-4" />
              <span>Cetak Struk Closing</span>
            </button>

            <a
              v-if="closingWaUrl"
              :href="closingWaUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#1fb858]"
            >
              <UIcon name="i-heroicons-chat-bubble-oval-left-ellipsis" class="h-4 w-4" />
              <span>Kirim Rekap ke WA Admin</span>
            </a>
          </div>

          <div class="flex items-center gap-2">
            <button
              type="button"
              class="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-[#0b1424] dark:text-slate-300"
              @click="isOpen = false"
            >
              Selesai
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-1 rounded-lg bg-[#ee6352] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#d84f3f]"
              @click="isOpen = false; emit('logout-requested')"
            >
              <UIcon name="i-heroicons-arrow-right-on-rectangle" class="h-4 w-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </UModal>
</template>
