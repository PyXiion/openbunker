<template>
  <div class="min-h-screen bg-base text-contrast p-6 overflow-y-auto">
    <div class="max-w-4xl mx-auto">
      <h1 class="text-3xl font-bold text-accent uppercase mb-8 border-b-2 border-contrast pb-4">
        {{ $t('pages.faq.title') }}
      </h1>
      
      <div class="space-y-6">
        <div
          v-for="index in questionCount"
          :key="index"
          class="border-2 border-contrast bg-base p-4"
        >
          <h2 class="text-lg font-bold text-accent uppercase mb-2">{{ $t(`pages.faq.q${index}.question`) }}</h2>
          <div class="prose text-contrast/80" v-html="renderedAnswers[index]"></div>
        </div>
      </div>
      
      <div class="mt-8">
        <NuxtLink
          to="/"
          class="tech-button inline-block"
        >
          {{ $t('pages.faq.backToHome') }}
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { render } = useMarkdown()
const { t } = useI18n()

const renderedAnswers = ref<Record<number, string>>({})
const questionCount = ref(0)

// Detect number of FAQ questions from translations
function detectQuestionCount() {
  let count = 0
  
  // Try to find q1, q2, q3, etc. until one doesn't exist
  while (true) {
    const key = `pages.faq.q${count + 1}.question`
    const translated = t(key)
    
    // If translation is different from the key, the question exists
    if (translated !== key) {
      count++
    } else {
      break
    }
  }
  
  return Math.max(count, 1)
}

// Render markdown on client-side after mount
onMounted(() => {
  questionCount.value = detectQuestionCount()
  
  for (let i = 1; i <= questionCount.value; i++) {
    renderedAnswers.value[i] = render(t(`pages.faq.q${i}.answer`))
  }
})
</script>
