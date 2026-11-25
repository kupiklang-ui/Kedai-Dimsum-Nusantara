<script setup lang="ts">
import type { SalesTrendPoint } from '~/types/pos'
import { formatRupiah } from '~/utils/format'

const props = defineProps<{
  points: SalesTrendPoint[]
}>()

const maxScale = computed(() => {
  const maxVal = Math.max(
    ...props.points.map(p => Math.max(p.omzet, p.labaKotor)),
    0
  )
  if (maxVal <= 0) return 100000
  const magnitude = 10 ** Math.floor(Math.log10(maxVal))
  return Math.ceil(maxVal / magnitude) * magnitude
})

const yAxisTicks = computed(() => {
  const top = maxScale.value
  return [top, Math.round(top * 0.75), Math.round(top * 0.5), Math.round(top * 0.25), 0]
})

function formatCompactRp(val: number): string {
  if (val <= 0) return '0'
  if (val >= 1_000_000) {
    return `${(val / 1_000_000).toFixed(val % 1_000_000 === 0 ? 0 : 1)}jt`
  }
  if (val >= 1_000) {
    return `${Math.round(val / 1_000)}rb`
  }
  return String(val)
}

function heightPct(value: number): number {
  if (value <= 0) return 4
  return Math.max(8, Math.min(100, Math.round((value / maxScale.value) * 100)))
}

const total7DaysOmzet = computed(() =>
  props.points.reduce((sum, p) => sum + p.omzet, 0)
)

const total7DaysLaba = computed(() =>
  props.points.reduce((sum, p) => sum + p.labaKotor, 0)
)
</script>

<template>
  <div class="saas-card rounded-2xl border border-slate-200/80 bg-white p-5 text-[#0f213d] dark:border-slate-800 dark:bg-[#111d33] dark:text-slate-100 sm:p-6">
    <!-- Header -->
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="text-base font-bold tracking-tight text-[#0f213d] dark:text-white">
          Tren Penjualan 7 Hari
        </h2>
        <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          Perbandingan total omzet dan estimasi laba kotor harian
        </p>
      </div>

      <div class="flex items-center gap-2">
        <span class="rounded-lg bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700 tabular-nums dark:bg-teal-950/60 dark:text-teal-300">
          Omzet: {{ formatRupiah(total7DaysOmzet) }}
        </span>
        <NuxtLink
          to="/reports"
          class="text-xs font-semibold text-[#0d9488] hover:underline dark:text-teal-400"
        >
          Lihat Laporan
        </NuxtLink>
      </div>
    </div>

    <!-- Legend & Summary Strip -->
    <div class="mt-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5 dark:border-slate-800">
      <div class="flex items-center gap-5 text-xs font-medium text-slate-600 dark:text-slate-300">
        <div class="flex items-center gap-2">
          <span class="h-2.5 w-2.5 rounded-sm bg-[#0d9488]" />
          <span>Total Omzet</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="h-2.5 w-2.5 rounded-sm bg-[#99d8d3] dark:bg-sky-400/75" />
          <span>Estimasi Laba</span>
        </div>
      </div>

      <p class="text-xs text-slate-500 tabular-nums dark:text-slate-400">
        Akumulasi Laba: <strong class="text-[#0f213d] dark:text-white">{{ formatRupiah(total7DaysLaba) }}</strong>
      </p>
    </div>

    <!-- Bar Chart -->
    <div class="mt-5 flex gap-3">
      <div class="flex h-52 flex-col justify-between pb-6 text-right text-[11px] font-medium text-slate-400 dark:text-slate-500 tabular-nums">
        <span v-for="tick in yAxisTicks" :key="tick">
          {{ formatCompactRp(tick) }}
        </span>
      </div>

      <div class="relative flex-1">
        <div class="pointer-events-none absolute inset-x-0 top-0 flex h-44 flex-col justify-between">
          <div
            v-for="tick in yAxisTicks"
            :key="`grid-${tick}`"
            class="border-b border-dashed border-slate-100 dark:border-slate-800"
          />
        </div>

        <div class="relative grid h-52 grid-cols-7 items-end gap-2 sm:gap-4">
          <div
            v-for="(point, idx) in points"
            :key="point.date"
            class="group relative flex h-full flex-col items-center justify-end"
          >
            <!-- Hover Tooltip -->
            <div
              class="pointer-events-none absolute -top-16 left-1/2 z-20 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-slate-700 bg-[#0f213d] px-3 py-2 text-left text-[11px] text-white shadow-lg group-hover:block"
            >
              <p class="font-semibold text-teal-300">{{ point.label }}</p>
              <p class="tabular-nums">Omzet: <strong>{{ formatRupiah(point.omzet) }}</strong></p>
              <p class="tabular-nums">Laba: <strong>{{ formatRupiah(point.labaKotor) }}</strong></p>
              <p class="text-[10px] text-slate-300 tabular-nums">{{ point.totalTransaksi }} pesanan</p>
            </div>

            <!-- Clean Vertical Columns -->
            <div class="flex h-44 w-full items-end justify-center gap-1 sm:gap-1.5">
              <div
                class="w-3 rounded-t-md bg-[#0d9488] transition-all duration-300 group-hover:bg-[#0b7a71] sm:w-4"
                :class="{ 'opacity-20': point.omzet <= 0 }"
                :style="{ height: `${heightPct(point.omzet)}%` }"
              />
              <div
                class="w-3 rounded-t-md bg-[#99d8d3] transition-all duration-300 group-hover:bg-[#5ec2bb] dark:bg-sky-400/75 dark:group-hover:bg-sky-300 sm:w-4"
                :class="{ 'opacity-20': point.labaKotor <= 0 }"
                :style="{ height: `${heightPct(point.labaKotor)}%` }"
              />
            </div>

            <p
              class="mt-2 text-[11px] font-medium"
              :class="idx === points.length - 1 ? 'font-bold text-[#0d9488] dark:text-teal-400' : 'text-slate-400 dark:text-slate-500'"
            >
              {{ point.label.split(',')[0] }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
