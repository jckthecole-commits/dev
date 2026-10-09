import { renderMarkdown } from '@/lib/markdown'

/** CMS markdown (raw HTML escaped in lib/markdown). */
export function ArticleBody({ markdown }: { markdown: string }) {
  return <div className="prose-sv" dangerouslySetInnerHTML={{ __html: renderMarkdown(markdown) }} />
}
