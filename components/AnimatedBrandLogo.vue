<script setup lang="ts">
const props = withDefaults(defineProps<{
  size?: 'sm' | 'md' | 'lg'
  alt?: string
  darkSurface?: boolean
}>(), {
  size: 'md',
  alt: 'Kedai Dimsum Nusantara',
  darkSurface: false
})

const sizeClasses = computed(() => {
  if (props.size === 'sm') return 'h-8 w-8 rounded-lg'
  if (props.size === 'lg') return 'h-16 w-16 rounded-2xl'
  return 'h-9 w-9 rounded-xl sm:h-10 sm:w-10'
})

const ringOffsetClasses = computed(() => {
  if (props.size === 'sm') return '-inset-0.5 rounded-[10px]'
  if (props.size === 'lg') return '-inset-1.5 rounded-[20px]'
  return '-inset-1 rounded-[14px]'
})
</script>

<template>
  <div class="group relative inline-flex shrink-0 items-center justify-center select-none">
    <!-- Subtle 60 FPS Ambient Pulse Glow -->
    <span
      class="brand-logo-glow pointer-events-none absolute rounded-full blur-[5px]"
      :class="[
        ringOffsetClasses,
        darkSurface ? 'bg-teal-400/30' : 'bg-[#0d9488]/25'
      ]"
      aria-hidden="true"
    />

    <!-- Subtle 60 FPS Rotating Accent Ring -->
    <span
      class="brand-logo-orbit pointer-events-none absolute rounded-full border border-dashed"
      :class="[
        ringOffsetClasses,
        darkSurface ? 'border-teal-300/60' : 'border-[#0d9488]/50 dark:border-teal-400/50'
      ]"
      aria-hidden="true"
    />

    <!-- Main 60 FPS Floating & Swaying Logo Frame -->
    <div
      class="brand-logo-float relative z-10 overflow-hidden bg-white shadow-sm transition-transform duration-300 group-hover:scale-110"
      :class="[
        sizeClasses,
        darkSurface
          ? 'ring-1 ring-white/30'
          : 'ring-1 ring-slate-200/90 dark:ring-slate-700'
      ]"
    >
      <img
        src="/images/logo-kedai.png"
        :alt="alt"
        class="h-full w-full object-cover"
        draggable="false"
      >
      <!-- Soft 60 FPS Diagonal Shine Sweep -->
      <span
        class="brand-logo-shine pointer-events-none absolute inset-0"
        aria-hidden="true"
      />
    </div>
  </div>
</template>

<style scoped>
/* GPU-Composited 60 FPS Logo Animations (transform & opacity only) */
.brand-logo-float {
  will-change: transform;
  animation: brandFloat60 3.2s ease-in-out infinite;
  backface-visibility: hidden;
}

.brand-logo-orbit {
  will-change: transform;
  animation: brandOrbit60 12s linear infinite;
}

.brand-logo-glow {
  will-change: transform, opacity;
  animation: brandGlow60 3.2s ease-in-out infinite;
}

.brand-logo-shine {
  background: linear-gradient(
    115deg,
    transparent 25%,
    rgba(255, 255, 255, 0.55) 50%,
    transparent 75%
  );
  will-change: transform;
  animation: brandShine60 4.5s ease-in-out infinite;
}

@keyframes brandFloat60 {
  0%, 100% {
    transform: translate3d(0, 0, 0) rotate(-3deg) scale3d(1, 1, 1);
  }
  50% {
    transform: translate3d(0, -3px, 0) rotate(3deg) scale3d(1.04, 1.04, 1);
  }
}

@keyframes brandOrbit60 {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes brandGlow60 {
  0%, 100% {
    opacity: 0.35;
    transform: scale3d(0.92, 0.92, 1);
  }
  50% {
    opacity: 0.8;
    transform: scale3d(1.08, 1.08, 1);
  }
}

@keyframes brandShine60 {
  0%, 62% {
    transform: translate3d(-140%, 0, 0);
  }
  100% {
    transform: translate3d(140%, 0, 0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .brand-logo-float,
  .brand-logo-orbit,
  .brand-logo-glow,
  .brand-logo-shine {
    animation: none !important;
  }
}
</style>
