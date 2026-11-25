<script setup lang="ts">
import type { ChannelStats } from '~/types/pos'
import { formatRupiah } from '~/utils/format'

const props = withDefaults(defineProps<{
  stats: ChannelStats
  qrisRevenueToday?: number
  tunaiRevenueToday?: number
  shopeeFoodRevenueToday?: number
  goFoodRevenueToday?: number
}>(), {
  qrisRevenueToday: 0,
  tunaiRevenueToday: 0,
  shopeeFoodRevenueToday: 0,
  goFoodRevenueToday: 0
})

const gaugeRadius = 66
const semiCircumference = Math.PI * gaugeRadius

// Semi-circular gauge showing total Non-Tunai + Driver Food digital share
const digitalPct = computed(() => {
  if (props.stats.totalTransaksi7Hari <= 0) return 0
  const nonCashCount = props.stats.qrisCount + (props.stats.shopeeFoodCount || 0) + (props.stats.goFoodCount || 0)
  return Math.max(0, Math.min(100, Math.round((nonCashCount / props.stats.totalTransaksi7Hari) * 100)))
})

const gaugeDashOffset = computed(() => {
  return semiCircumference * (1 - digitalPct.value / 100)
})

const rows = computed(() => [
  {
    label: 'QRIS (Non-Tunai)',
    count: props.stats.qrisCount,
    pct: props.stats.qrisPct,
    todayAmount: props.qrisRevenueToday,
    barColor: '#0d9488',
    badgeClass: 'bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300',
    icon: 'i-heroicons-qr-code'
  },
  {
    label: 'Tunai (Cash)',
    count: props.stats.tunaiCount,
    pct: props.stats.tunaiPct,
    todayAmount: props.tunaiRevenueToday,
    barColor: '#0f213d',
    badgeClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
    icon: 'i-heroicons-banknotes'
  },
  {
    label: 'Driver ShopeeFood',
    count: props.stats.shopeeFoodCount || 0,
    pct: props.stats.shopeeFoodPct || 0,
    todayAmount: props.shopeeFoodRevenueToday,
    barColor: '#ee4d2d',
    badgeClass: 'bg-orange-50 text-[#ee4d2d] dark:bg-orange-950/60 dark:text-orange-300',
    icon: 'i-heroicons-shopping-bag'
  },
  {
    label: 'Driver GoFood (Gojek)',
    count: props.stats.goFoodCount || 0,
    pct: props.stats.goFoodPct || 0,
    todayAmount: props.goFoodRevenueToday,
    barColor: '#00aa13',
    badgeClass: 'bg-emerald-50 text-[#00aa13] dark:bg-emerald-950/60 dark:text-emerald-300',
    icon: 'i-heroicons-truck'
  }
])
</script>

<template>
  <div class="saas-card flex h-full flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 text-[#0f213d] dark:border-slate-800 dark:bg-[#111d33] dark:text-slate-100 sm:p-6">
    <!-- Header -->
    <div class="flex items-start justify-between gap-2">
      <div>
        <h2 class="text-base font-bold tracking-tight text-[#0f213d] dark:text-white">
          Kanal Pembayaran &amp; Driver
        </h2>
        <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          QRIS, Tunai, ShopeeFood &amp; GoFood (7 hari)
        </p>
      </div>
      <span class="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 tabular-nums dark:bg-slate-800 dark:text-slate-300">
        {{ stats.totalTransaksi7Hari }} trx
      </span>
    </div>

    <!-- Semi-Circular Progress Gauge -->
    <div class="my-2 flex flex-col items-center">
      <svg viewBox="0 0 180 104" class="h-28 w-48">
        <path
          d="M 24 90 A 66 66 0 0 1 156 90"
          fill="none"
          class="stroke-slate-100 dark:stroke-slate-800"
          stroke-width="14"
          stroke-linecap="round"
        />
        <path
          d="M 24 90 A 66 66 0 0 1 156 90"
          fill="none"
          stroke="#0d9488"
          stroke-width="14"
          stroke-linecap="round"
          :stroke-dasharray="semiCircumference"
          :stroke-dashoffset="gaugeDashOffset"
          class="transition-all duration-700 ease-out"
        />
        <text
          x="90"
          y="72"
          text-anchor="middle"
          class="fill-[#0f213d] dark:fill-white tabular-nums"
          font-size="22"
          font-weight="800"
        >
          {{ digitalPct }}%
        </text>
        <text
          x="90"
          y="90"
          text-anchor="middle"
          class="fill-slate-500 dark:fill-slate-400"
          font-size="9.5"
          font-weight="600"
        >
          Non-Tunai &amp; Driver
        </text>
      </svg>
    </div>

    <!-- Clean 4-Channel Progress Bars -->
    <div class="space-y-2.5 border-t border-slate-100 pt-3 dark:border-slate-800">
      <div v-for="row in rows" :key="row.label" class="space-y-1">
        <div class="flex items-center justify-between text-xs">
          <div class="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
            <span class="flex h-5 w-5 items-center justify-center rounded-md" :class="row.badgeClass">
              <UIcon :name="row.icon" class="h-3.5 w-3.5" />
            </span>
            <span>{{ row.label }}</span>
          </div>
          <div class="text-right tabular-nums">
            <span class="font-bold text-[#0f213d] dark:text-white">{{ row.count }} trx</span>
            <span class="ml-1 text-[10px] text-slate-400">· {{ formatRupiah(row.todayAmount) }}</span>
          </div>
        </div>

        <div class="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            class="h-full rounded-full transition-all duration-500"
            :style="{
              width: `${row.pct > 0 ? Math.max(8, row.pct) : 0}%`,
              backgroundColor: row.barColor
            }"
          />
        </div>
      </div>
    </div>
  </div>
</template>
