<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const toast = useToast()

const isOpen = computed({
  get: () => props.modelValue,
  set: (val: boolean) => emit('update:modelValue', val)
})

const qrisUrl = ref('/images/qris-default.svg')
const hasCustomQris = ref(false)
const loading = ref(false)
const uploading = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

async function fetchQris() {
  loading.value = true
  try {
    const res = await $fetch<{ success: boolean, hasCustomQris: boolean, url: string }>('/api/uploads/qris')
    qrisUrl.value = res.url
    hasCustomQris.value = res.hasCustomQris
  } catch {
    qrisUrl.value = '/images/qris-default.svg'
    hasCustomQris.value = false
  } finally {
    loading.value = false
  }
}

watch(() => props.modelValue, (opened) => {
  if (opened) {
    fetchQris()
  }
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

    qrisUrl.value = res.url
    hasCustomQris.value = true

    toast.add({
      title: 'QRIS Toko Diperbarui',
      description: 'Gambar QRIS baru akan langsung tampil di layar Kasir (POS).',
      color: 'green',
      icon: 'i-heroicons-check-circle'
    })
  } catch (err: unknown) {
    const fetchErr = err as { data?: { statusMessage?: string }, message?: string }
    toast.add({
      title: 'Gagal Upload QRIS',
      description: fetchErr?.data?.statusMessage || fetchErr?.message || 'Format gambar harus JPG/PNG/WEBP (maks. 5 MB).',
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
</script>

<template>
  <UModal v-model="isOpen" :ui="{ width: 'sm:max-w-md' }">
    <div class="overflow-hidden rounded-2xl bg-white text-[#0f213d] dark:bg-[#111d33] dark:text-slate-100">
      <div class="flex items-center justify-between border-b border-slate-200 bg-[#0f213d] px-5 py-4 text-white dark:border-slate-800">
        <div class="flex items-center gap-2.5">
          <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0d9488] text-white">
            <UIcon name="i-heroicons-qr-code" class="h-5 w-5" />
          </div>
          <div>
            <h3 class="text-sm font-bold">Pengaturan Gambar QRIS Toko</h3>
            <p class="text-[11px] text-teal-200/85">Otomatis ditampilkan saat Kasir memilih bayar QRIS</p>
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

      <div class="flex flex-col items-center p-5 text-center">
        <span
          class="mb-3 rounded-lg px-3 py-1 text-[11px] font-bold"
          :class="hasCustomQris ? 'bg-teal-50 text-[#0d9488] dark:bg-teal-950/60 dark:text-teal-300' : 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'"
        >
          {{ hasCustomQris ? 'QRIS Kustom Toko Aktif' : 'Menggunakan QRIS Default' }}
        </span>

        <div class="w-full max-w-[250px] overflow-hidden rounded-2xl border-2 border-slate-200 bg-white p-2 shadow-sm dark:border-slate-600">
          <div v-if="loading" class="flex h-64 items-center justify-center text-xs text-slate-400">
            Memuat gambar QRIS...
          </div>
          <img
            v-else
            :src="qrisUrl"
            alt="Preview QRIS Toko"
            class="mx-auto max-h-[290px] w-full rounded-xl object-contain"
          >
        </div>

        <p class="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Unggah gambar QRIS resmi kedai Anda (JPG, PNG, atau WEBP · maks. 5 MB).
        </p>

        <input
          ref="fileInputRef"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          class="hidden"
          @change="handleFileChange"
        >
      </div>

      <div class="flex items-center justify-end gap-2.5 border-t border-slate-200 bg-slate-50 px-5 py-3.5 dark:border-slate-800 dark:bg-[#0b1424]">
        <button
          type="button"
          class="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-[#15243d] dark:text-slate-200 dark:hover:bg-slate-800"
          @click="isOpen = false"
        >
          Tutup
        </button>
        <button
          type="button"
          :disabled="uploading"
          class="inline-flex items-center gap-1.5 rounded-lg bg-[#0d9488] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#0b7a71] disabled:opacity-60"
          @click="triggerUpload"
        >
          <UIcon
            :name="uploading ? 'i-heroicons-arrow-path' : 'i-heroicons-arrow-up-tray'"
            class="h-4 w-4"
            :class="{ 'animate-spin': uploading }"
          />
          <span>{{ uploading ? 'Mengunggah...' : hasCustomQris ? 'Ganti Gambar QRIS' : 'Upload Gambar QRIS' }}</span>
        </button>
      </div>
    </div>
  </UModal>
</template>
