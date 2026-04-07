<template>
  <div class="markdown-content" v-html="renderedContent"></div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import MarkdownIt from 'markdown-it/dist/markdown-it.min.js';
import DOMPurify from 'dompurify';

const props = defineProps<{
  content: string;
}>();

// Initialize markdown-it
const md = new MarkdownIt({
  html: false,        // Disable HTML tags
  linkify: true,      // Autoconvert URL-like text to links
  typographer: true,  // Enable some language-neutral replacement + quotes beautification
  breaks: true,       // Convert '\n' to <br>
});

const renderedContent = computed(() => {
  if (!props.content) return '';
  
  try {
    // Render markdown to HTML
    const html = md.render(props.content) as string;
    
    // Sanitize HTML to prevent XSS
    const sanitized = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'code', 'pre', 'a', 'ul', 'ol', 'li', 'blockquote', 'h1', 'h2', 'h3'],
      ALLOWED_ATTR: ['href', 'target', 'rel'],
      ALLOW_DATA_ATTR: false
    });
    
    return sanitized;
  } catch (error) {
    console.error('Markdown rendering error:', error);
    return props.content; // Fallback to plain text
  }
});
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
