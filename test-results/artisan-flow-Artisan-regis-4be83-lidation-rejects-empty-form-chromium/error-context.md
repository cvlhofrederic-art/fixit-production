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
  - alert [ref=e19]
```