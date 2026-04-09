<template>
  <div class="relative">
    <select
      v-model="currentLocale"
      @change="changeLanguage"
      class="bg-base border-2 border-contrast p-1 text-sm font-mono uppercase cursor-pointer focus:outline-none focus:border-accent"
    >
      <option
        v-for="locale in availableLocales"
        :key="locale.code"
        :value="locale.code"
      >
        {{ locale.name }}
      </option>
    </select>
  </div>
</template>

<script setup lang="ts">
const { locale, locales, setLocale } = useI18n();

const currentLocale = ref(locale.value);

const availableLocales = computed(() => {
  return locales.value.map(l => ({ code: l.code, name: l.name }));
});

function changeLanguage() {
  setLocale(currentLocale.value);
}
</script>
