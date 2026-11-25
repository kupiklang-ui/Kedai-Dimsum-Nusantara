<script setup lang="ts">
import { formatRupiah } from '~/utils/format'

const props = defineProps<{
  modelValue: boolean
  qrisUrl: string
  hasCustomQris: boolean
  amount: number
  invoiceNo: string
  canCheckout: boolean
  validationMessage?: string
  isSubmitting: boolean
  canUploadQris: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirmCheckout: []
  qrisUploaded: [url: string]
}>()

const config = useRuntimeConfig()
const toast = useToast()

const fileInputRef = ref<HTMLInputElement | null>(null)
const uploading = ref(false)

const isOpen = computed({
  get: () => props.modelValue,
  set: (val: boolean) => emit('update:modelValue', val)
})

function triggerUpload() {
  fileInputRef.value?.click()
}

async function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  uploading.value = true
  try {
    const body = new FormData()
    body.append('file', file)

    const res = await $fetch<{ success: boolean, message: string, url: string }>('/api/uploads/qris', {
      method: 'POST',
      body
    })

    toast.add({
      title: 'QRIS Toko Diperbarui',
      description: res.message,
      color: 'green',
      icon: 'i-heroicons-check-circle'
    })
    emit('qrisUploaded', res.url)
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string }, message?: string }
    toast.add({
      title: 'Gagal Upload QRIS',
      description: fetchErr?.data?.statusMessage || fetchErr?.message || 'Coba pilih gambar JPG/PNG lain.',
      color: 'red',
      icon: 'i-heroicons-exclamation-triangle'
    })
  } finally {
    uploading.value = false
    if (fileInputRef.value) {
      fileInputRef.value.value = ''
    }
  }
}

function handleConfirm() {
  if (!props.canCheckout) {
    toast.add({
      title: 'Belum Bisa Konfirmasi',
      description: props.validationMessage || 'Pilih minimal 1 menu dimsum ke keranjang terlebih dahulu.',
      color: 'amber',
      icon: 'i-heroicons-exclamation-triangle'
    })
    return
  }
  isOpen.value = false
  emit('confirmCheckout')
}
</script>

<template>
  <UModal v-model="isOpen" :ui="{ width: 'sm:max-w-md' }">
    <div class="overflow-hidden rounded-2xl bg-white text-[#0f213d] dark:bg-[#111d33] dark:text-slate-100">
      <!-- Top Header -->
      <div class="flex items-center justify-between border-b border-slate-200 bg-[#0f213d] px-5 py-4 text-white dark:border-slate-800">
        <div class="flex items-center gap-2.5">
          <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0d9488] text-white">
            <UIcon name="i-heroicons-qr-code" class="h-5 w-5" />
          </div>
          <div>
            <h3 class="text-sm font-bold">Pembayaran QRIS</h3>
            <p class="font-mono text-[11px] text-teal-300 tabular-nums">{{ invoiceNo }}</p>
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

      <!-- Customer-Facing QR Display -->
      <div class="flex flex-col items-center p-5 text-center">
        <p class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {{ config.public.storeName }}
        </p>

        <div class="mt-1.5 rounded-lg bg-teal-50 px-4 py-1 text-xl font-extrabold text-[#0d9488] tabular-nums dark:bg-teal-950/60 dark:text-teal-300">
          {{ formatRupiah(amount) }}
        </div>

        <div class="mt-4 w-full max-w-[270px] overflow-hidden rounded-2xl border-2 border-slate-200 bg-white p-2 shadow-sm dark:border-slate-600">
          <img
            :src="qrisUrl"
            alt="Kode QRIS Pembayaran"
            class="mx-auto max-h-[310px] w-full rounded-xl object-contain"
          >
        </div>

        <p class="mt-3 text-xs font-medium text-slate-600 dark:text-slate-300">
          Tunjukkan layar ini ke pelanggan untuk scan via GoPay, OVO, DANA, ShopeePay, atau Mobile Banking.
        </p>

        <!-- Admin Upload Custom QRIS Button -->
        <div v-if="canUploadQris" class="mt-3">
          <input
            ref="fileInputRef"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            class="hidden"
            @change="handleFileChange"
          >
          <button
            type="button"
            :disabled="uploading"
            class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-[#0d9488] hover:bg-teal-50 hover:text-[#0d9488] disabled:opacity-50 dark:border-slate-700 dark:bg-[#0b1424] dark:text-slate-200"
            @click="triggerUpload"
          >
            <UIcon
              :name="uploading ? 'i-heroicons-arrow-path' : 'i-heroicons-arrow-up-tray'"
              class="h-3.5 w-3.5"
              :class="{ 'animate-spin': uploading }"
            />
            <span>
              {{ uploading ? 'Mengunggah QRIS...' : hasCustomQris ? 'Ganti Gambar QRIS Toko' : 'Upload Gambar QRIS Toko Asli' }}
            </span>
          </button>
        </div>
      </div>

      <!-- Footer -->
      <div class="border-t border-slate-200 bg-slate-50 px-5 py-3.5 dark:border-slate-800 dark:bg-[#0b1424]">
        <p
          v-if="!canCheckout && validationMessage"
          class="mb-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-center text-[11px] font-semibold text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/50 dark:text-amber-300"
        >
          {{ validationMessage }}
        </p>
        <div class="flex items-center justify-end gap-2.5">
          <button
            type="button"
            class="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-[#15243d] dark:text-slate-200 dark:hover:bg-slate-800"
            @click="isOpen = false"
          >
            Tutup
          </button>
          <button
            type="button"
            :disabled="isSubmitting"
            class="inline-flex items-center gap-1.5 rounded-lg bg-[#0d9488] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#0b7a71] disabled:cursor-not-allowed disabled:opacity-60"
            @click="handleConfirm"
          >
            <UIcon
              :name="isSubmitting ? 'i-heroicons-arrow-path' : 'i-heroicons-check-circle'"
              class="h-4 w-4"
              :class="{ 'animate-spin': isSubmitting }"
            />
            <span>{{ isSubmitting ? 'Memproses...' : 'Konfirmasi Lunas & Cetak Struk' }}</span>
          </button>
        </div>
      </div>
    </div>
  </UModal>
</template>
