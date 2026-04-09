import MarkdownIt from 'markdown-it/dist/markdown-it.min.js';
import DOMPurify from 'dompurify';

// Singleton instance of MarkdownIt to avoid recreating on every render
let mdInstance: MarkdownIt | null = null;

/**
 * Returns a singleton MarkdownIt instance configured for the app.
 * This avoids creating a new instance on every component render.
 */
export function useMarkdown() {
  if (!mdInstance) {
    mdInstance = new MarkdownIt({
      html: false,        // Disable HTML tags
      linkify: true,      // Autoconvert URL-like text to links
      typographer: true,  // Enable some language-neutral replacement + quotes beautification
      breaks: true,       // Convert '\n' to <br>
    });
  }

  return {
    md: mdInstance!,
    render: (content: string): string => {
      if (!content) return '';
      
      try {
        // Render markdown to HTML
        const html = mdInstance!.render(content) as string;
        
        // Sanitize HTML to prevent XSS
        const sanitized = DOMPurify.sanitize(html, {
          ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'code', 'pre', 'a', 'ul', 'ol', 'li', 'blockquote', 'h1', 'h2', 'h3'],
          ALLOWED_ATTR: ['href', 'target', 'rel'],
          ALLOW_DATA_ATTR: false
        });
        
        return sanitized;
      } catch (error) {
        console.error('Markdown rendering error:', error);
        return content; // Fallback to plain text
      }
    }
  };
}
