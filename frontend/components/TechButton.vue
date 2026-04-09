<template>
  <button
    :class="buttonClasses"
    :disabled="disabled || isLoading"
    @click="handleClick"
  >
    <span v-if="!isLoading">
      <slot />
    </span>
    <span v-else class="animate-pulse">...</span>
  </button>
</template>

<script setup lang="ts">
interface Props {
  variant?: 'primary' | 'secondary' | 'accent' | 'contrast' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  isLoading?: boolean;
  fullWidth?: boolean;
  className?: string;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  disabled: false,
  isLoading: false,
  fullWidth: false,
  className: '',
});

const emit = defineEmits<{
  click: [event: MouseEvent];
}>();

const handleClick = (event: MouseEvent) => {
  if (!props.disabled && !props.isLoading) {
    emit('click', event);
  }
};

const buttonClasses = computed(() => {
  const baseClasses = 'tech-button';
  
  const variantClasses = {
    primary: '',
    secondary: 'border-contrast/50 text-contrast/70 hover:border-contrast hover:bg-contrast hover:text-white',
    accent: 'border-accent text-accent hover:bg-accent hover:text-white',
    contrast: 'border-contrast text-contrast hover:bg-contrast hover:text-white',
    ghost: 'border-transparent text-contrast/70 hover:text-contrast',
  };
  
  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: '',
    lg: 'text-lg px-6 py-3',
  };
  
  const classes = [
    baseClasses,
    variantClasses[props.variant],
    sizeClasses[props.size],
    props.fullWidth ? 'w-full' : '',
    props.disabled ? 'disabled:opacity-50' : '',
    props.className,
  ];
  
  return classes.filter(Boolean).join(' ');
});
</script>
