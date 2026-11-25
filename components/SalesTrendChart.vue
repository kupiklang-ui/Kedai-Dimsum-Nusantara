<script setup lang="ts">
import type { SalesTrendPoint } from '~/types/pos'
import { formatRupiah } from '~/utils/format'

const props = defineProps<{
  points: SalesTrendPoint[]
}>()

const maxOmzet = computed(() => {
  const maxVal = Math.max(...props.points.map(p => p.omzet), 0)
  return maxVal > 0 ? maxVal : 1
})

const total7DaysOmzet = computed(() =>
  props.points.reduce((sum, point) => sum + point.omzet, 0)
)

const total7DaysTrx = computed(() =>
  props.points.reduce((sum, point) => sum + point.totalTransaksi, 0)
)

function barHeightPercent(omzet: number): number {
  if (omzet <= 0) return 4
  return Math.max(10, Math.round((omzet / maxOmzet.value) * 100))
}
</script>

<template>
  <div class="rounded-2xl border border-[#244a30] bg-[#15301f] p-5 shadow-lg">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="text-base font-bold text-white">
          Tren Penjualan 7 Hari Terakhir
        </h2>
        <p class="mt-0.5 text-xs text-emerald-100/65">
          Ringkasan omzet harian kedai dimsum
        </p>
      </div>
      <div class="text-right">
        <p class="text-[11px] font-medium uppercase tracking-wider text-emerald-200/60">
          Total 7 Hari
        </p>
        <p class="text-lg font-extrabold text-[#95c93d] tabular-nums">
          {{ formatRupiah(total7DaysOmzet) }}
        </p>
        <p class="text-[11px] text-emerald-100/60 tabular-nums">
          {{ total7DaysTrx }} transaksi
        </p>
      </div>
    </div>

    <!-- Bar Chart Area -->
    <div class="mt-6">
      <div class="grid h-52 grid-cols-7 items-end gap-2 sm:gap-3">
        <div
          v-for="(point, idx) in points"
          :key="point.date"
          class="group relative flex h-full flex-col items-center justify-end"
        >
          <!-- Hover Tooltip -->
          <div
            class="pointer-events-none absolute -top-12 z-10 hidden whitespace-nowrap rounded-lg border border-[#95c93d]/40 bg-[#0b1b11] px-2.5 py-1.5 text-center shadow-xl group-hover:block"
          >
            <p class="text-[11px] font-bold text-[#95c93d] tabular-nums">
              {{ formatRupiah(point.omzet) }}
            </p>
            <p class="text-[10px] text-emerald-100/75 tabular-nums">
              {{ point.totalTransaksi }} pesanan
            </p>
          </div>

          <!-- Bar Column -->
          <div class="flex h-40 w-full items-end justify-center rounded-xl bg-[#0e2216]/70 p-1">
            <div
              class="w-full rounded-lg transition-all duration-300"
              :class="
                idx === points.length - 1
                  ? 'bg-gradient-to-t from-[#4b7b2b] to-[#95c93d] shadow-md shadow-[#95c93d]/20'
                  : point.omzet > 0
                    ? 'bg-gradient-to-t from-[#2a5436] to-[#68a33a] group-hover:to-[#95c93d]'
                    : 'bg-[#1d3c27]'
              "
              :style="{ height: `${barHeightPercent(point.omzet)}%` }"
            />
          </div>

          <!-- Date Label -->
          <p
            class="mt-2 truncate text-[10px] font-medium sm:text-[11px]"
            :class="idx === points.length - 1 ? 'font-bold text-[#95c93d]' : 'text-emerald-100/70'"
          >
            {{ point.label.split(',')[0] }}
          </p>
          <p class="text-[9px] text-emerald-200/45 tabular-nums">
            {{ point.label.split(',')[1]?.trim() }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
