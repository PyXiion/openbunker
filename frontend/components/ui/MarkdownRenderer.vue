<template>
  <div class="markdown-content" v-html="renderedContent"></div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useMarkdown } from '~/composables/useMarkdown';

const props = defineProps<{
  content: string;
}>();

const { render } = useMarkdown();

const renderedContent = computed(() => render(props.content));
</script>

<style scoped>
.markdown-content {
  line-height: 1.4;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

:deep(p) {
  margin: 0;
}

:deep(p:first-child) {
  margin-top: 0;
}

:deep(p:last-child) {
  margin-bottom: 0;
}

:deep(strong) {
  color: var(--accent-color, #ff4444);
  font-weight: bold;
}

:deep(em) {
  color: var(--contrast-color, #e5e5e5);
  font-style: italic;
}

:deep(code) {
  background: var(--contrast-color, #e5e5e5);
  color: var(--base-color, #1a1a1a);
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  font-family: 'Courier New', monospace;
  font-size: 0.875em;
}

:deep(pre) {
  background: var(--contrast-color, #e5e5e5);
  color: var(--base-color, #1a1a1a);
  padding: 0.5rem;
  border-radius: 0.25rem;
  font-family: 'Courier New', monospace;
  font-size: 0.875em;
  overflow-x: auto;
  margin: 0.25rem 0;
}

:deep(a) {
  color: var(--accent-color, #ff4444);
  text-decoration: underline;
}

:deep(a:hover) {
  color: var(--accent-color, #ff6666);
  text-decoration: none;
}

:deep(ul), :deep(ol) {
  margin: 0.25rem 0;
  padding-left: 1.5rem;
}

:deep(li) {
  margin: 0.125rem 0;
}

:deep(blockquote) {
  border-left: 2px solid var(--accent-color, #ff4444);
  padding-left: 0.75rem;
  margin: 0.25rem 0;
  color: var(--contrast-color, #e5e5e5);
  opacity: 0.8;
}

:deep(h1), :deep(h2), :deep(h3) {
  margin: 0.5rem 0 0.25rem 0;
  color: var(--accent-color, #ff4444);
}

:deep(h1) { font-size: 1.1em; }
:deep(h2) { font-size: 1.05em; }
:deep(h3) { font-size: 1em; }
</style>
