---
name: review-step
description: Review my implementation of the current roadmap step like a senior AI engineer, then tick it off in docs/ROADMAP.md.
disable-model-invocation: true
argument-hint: "[optional step number]"
---

Review the step I just implemented (`$ARGUMENTS` if given, else the first unchecked step in `docs/ROADMAP.md`).

1. Run `npm run check` and report the result. If it fails, explain why and give a hint, not the fix.
2. Review the diff for: correctness and edge cases, respecting the ports & adapters rules in CLAUDE.md, API cost/latency (number of LLM/embedding calls), prompt quality, and readability.
3. Give feedback as: ✅ what's good, ⚠️ what to improve (ordered by importance), and one 💡 stretch goal.
4. If it works, tick the step in `docs/ROADMAP.md` and add a one-line "Learned:" note under it in my own words (ask me for the sentence).
