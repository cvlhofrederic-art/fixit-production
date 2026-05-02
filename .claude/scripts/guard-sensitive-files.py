#!/usr/bin/env python3
"""
PreToolUse hook — block Write/Edit on sensitive files unless explicitly authorized.

Aligned with Anthropic guidance on PreToolUse as deterministic gate
(https://code.claude.com/docs/en/hooks-guide).

Sensitive paths (Vitfix.io):
- supabase/migrations/*.sql      — DB schema, irreversible
- wrangler.toml                  — Cloudflare runtime config + ANON keys
- .env, .env.local, .env.production — secrets
- next.config.ts, sentry.*.config.ts — runtime/observability boundaries
- package.json (deps mutation must go through npm)

Decision: "ask" (prompts user) for these paths. The user can override on a per-edit basis.
"""

import json
import re
import sys

SENSITIVE_PATTERNS = [
    (re.compile(r"(^|/)supabase/migrations/[^/]+\.sql$"), "Migration SQL — irreversible. Vérifier RLS + tester en staging."),
    (re.compile(r"(^|/)wrangler\.toml$"), "Config Cloudflare Workers — secrets via `wrangler secret put`, pas en clair."),
    (re.compile(r"(^|/)\.env(\..+)?$"), "Fichier secrets — JAMAIS committer. Utiliser `wrangler secret` côté prod."),
    (re.compile(r"(^|/)next\.config\.(ts|mjs|js)$"), "Config Next.js runtime — impact build + déploiement."),
    (re.compile(r"(^|/)sentry\.(client|server|edge)\.config\.(ts|mjs|js)$"), "Sentry runtime — bug récurrent : blocs roses dashboard syndic. Cf. MEMORY.md."),
    (re.compile(r"(^|/)package\.json$"), "Mutations deps doivent passer par `npm install <pkg>`, pas édition manuelle."),
]


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        return 0

    tool_input = payload.get("tool_input") or {}
    file_path = tool_input.get("file_path", "")
    if not file_path:
        return 0

    for pattern, reason in SENSITIVE_PATTERNS:
        match = pattern.search(file_path)
        if match:
            display = match.group(0).lstrip("/")
            decision = {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "ask",
                    "permissionDecisionReason": f"[guard-sensitive] {display} → {reason}",
                }
            }
            json.dump(decision, sys.stdout)
            return 0

    return 0


if __name__ == "__main__":
    sys.exit(main())
