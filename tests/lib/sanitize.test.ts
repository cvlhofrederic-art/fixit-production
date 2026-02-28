import { describe, it, expect } from 'vitest'
import { escapeHTML, safeMarkdownToHTML } from '@/lib/sanitize'

describe('escapeHTML', () => {
  it('should escape HTML characters', () => {
    expect(escapeHTML('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;')
  })

  it('should escape ampersands', () => {
    expect(escapeHTML('a & b')).toBe('a &amp; b')
  })

  it('should escape single quotes', () => {
    expect(escapeHTML("it's")).toBe("it&#039;s")
  })
})

describe('safeMarkdownToHTML', () => {
  it('should return empty string for empty input', () => {
    expect(safeMarkdownToHTML('')).toBe('')
  })

  it('should convert bold text', () => {
    const result = safeMarkdownToHTML('**hello**')
    expect(result).toContain('<strong')
    expect(result).toContain('hello')
  })

  it('should escape HTML before processing markdown', () => {
    const result = safeMarkdownToHTML('<script>**bold**</script>')
    expect(result).not.toContain('<script>')
    expect(result).toContain('&lt;script&gt;')
  })

  it('should truncate content over 50000 chars', () => {
    const longContent = 'a'.repeat(50001)
    expect(safeMarkdownToHTML(longContent)).toBe('<p>Contenu trop long</p>')
  })
})
