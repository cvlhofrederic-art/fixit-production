#!/usr/bin/env python3
"""
Stop hook — reminder to run tests if code was modified during the session.

Aligned with Anthropic guidance on Stop hooks for verification gates
(https://code.claude.com/docs/en/hooks-guide).

Soft reminder only (systemMessage), does not block. Triggers if `git diff` shows
modifications to .ts/.tsx/.py files since the last commit (excluding .claude/).
"""

import json
import os
import subprocess
import sys


def has_uncommitted_code_changes() -> bool:
    try:
        result = subprocess.run(
            ["git", "diff", "--name-only", "HEAD"],
            capture_output=True,
            text=True,
            timeout=3,
            check=False,
        )
        if result.returncode != 0:
            return False
        files = result.stdout.strip().splitlines()
        # Only count code files outside .claude/
        return any(
            f.endswith((".ts", ".tsx", ".py", ".sql"))
            and not f.startswith(".claude/")
            for f in files
        )
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        return False


def main() -> int:
    try:
        json.load(sys.stdin)  # consume payload
    except (json.JSONDecodeError, ValueError):
        pass

    if not has_uncommitted_code_changes():
        return 0

    json.dump(
        {
            "systemMessage": "[stop-reminder] Code modifié non committé détecté. Avant de clore : `npm run test` (Vitest) + `npm run test:e2e` si parcours critique touché. Cf. .claude/rules/testing.md."
        },
        sys.stdout,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
