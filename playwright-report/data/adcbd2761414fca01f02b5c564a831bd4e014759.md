# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - link "Skip to main content" [ref=e2] [cursor=pointer]:
    - /url: "#main-content"
  - main [ref=e3]:
    - generic [ref=e5]:
      - generic [ref=e6]: "404"
      - heading "Page not found" [level=1] [ref=e7]
      - paragraph [ref=e8]: Sorry, the page you are looking for does not exist or has been moved.
      - generic [ref=e9]:
        - link "Back to home" [ref=e10] [cursor=pointer]:
          - /url: /en/
        - link "Find a professional" [ref=e11] [cursor=pointer]:
          - /url: /recherche/
  - dialog "cookie.consentLabel" [ref=e12]:
    - generic [ref=e13]:
      - paragraph [ref=e14]: cookie.fullMessage
      - generic [ref=e15]:
        - button "cookie.decline" [ref=e16] [cursor=pointer]
        - button "Customise" [ref=e17] [cursor=pointer]
        - button "cookie.accept" [ref=e18] [cursor=pointer]
  - region "Notifications alt+T"
  - generic [ref=e23] [cursor=pointer]:
    - button "Open Next.js Dev Tools" [ref=e24]:
      - img [ref=e25]
    - generic [ref=e28]:
      - button "Open issues overlay" [ref=e29]:
        - generic [ref=e30]:
          - generic [ref=e31]: "0"
          - generic [ref=e32]: "1"
        - generic [ref=e33]: Issue
      - button "Collapse issues badge" [ref=e34]:
        - img [ref=e35]
  - alert [ref=e37]
```