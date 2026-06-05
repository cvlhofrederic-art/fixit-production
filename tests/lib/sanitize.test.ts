import { describe, it, expect } from 'vitest'
import { escapeHTML, safeMarkdownToHTML, sanitizeSvg } from '@/lib/sanitize'

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

describe('sanitizeSvg (anti stored-XSS signatures)', () => {
  it('conserve un SVG de signature simple + casse viewBox', () => {
    const ok = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"><path d="M10 10 L90 40" stroke="black" fill="none"/></svg>'
    const out = sanitizeSvg(ok)
    expect(out).toContain('<path')
    expect(out).toContain('viewBox=') // casse préservée (pas "viewbox")
    expect(out).toContain('d="M10 10 L90 40"')
  })
  it('retire <script>', () => {
    expect(sanitizeSvg('<svg><script>alert(1)</script><path d="M0 0"/></svg>')).not.toMatch(/script/i)
  })
  it('retire les handlers on*', () => {
    expect(sanitizeSvg('<svg onload="alert(1)"><path d="M0 0" onclick="x"/></svg>')).not.toMatch(/onload|onclick/i)
  })
  it('retire tout href/xlink:href (même bénin) → ferme le vecteur javascript:', () => {
    expect(sanitizeSvg('<svg><a href="javascript:alert(1)"><path d="M0"/></a></svg>')).not.toMatch(/javascript|href/i)
    expect(sanitizeSvg('<svg><path xlink:href="x" d="M0"/></svg>')).not.toMatch(/href/i)
  })
  it('retire foreignObject/iframe/use/image', () => {
    expect(sanitizeSvg('<svg><foreignObject><iframe src="x"></iframe></foreignObject><use href="#y"/></svg>')).not.toMatch(/foreignObject|iframe|<use/i)
  })
  it('retourne vide si > 50 ko (anti-DoS)', () => {
    expect(sanitizeSvg('<svg>' + 'a'.repeat(60000) + '</svg>')).toBe('')
  })
  it('ne laisse pas de motif reconstruit (commentaire/script imbriqués)', () => {
    expect(sanitizeSvg('<svg><!--<!-- x -->--><path d="M0"/></svg>')).not.toContain('<!--')
    expect(sanitizeSvg('<svg><scr<script></script>ipt>alert(1)</scr<script></script>ipt><path d="M0"/></svg>')).not.toMatch(/<script/i)
  })
})
