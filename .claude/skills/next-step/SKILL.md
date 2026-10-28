---
name: next-step
description: Start the next unchecked step of docs/ROADMAP.md as a hands-on lesson (concept + TODO scaffold + failing tests, no solution).
disable-model-invocation: true
argument-hint: "[optional step number, e.g. 2.3]"
---

Start a learning step from `docs/ROADMAP.md`.

1. Read `CLAUDE.md` and `docs/ROADMAP.md`. If `$ARGUMENTS` names a step, use that one; otherwise pick the first unchecked `- [ ]` step.
2. Explain the concept behind the step in at most 10 lines. Use an analogy from C#/.NET or JavaScript. Mention the one mistake people most often make with it.
3. Create the scaffold:
   - new/changed source files with types, function signatures and `// TODO:` comments that describe what to implement, in the right layer (see the architecture rules in CLAUDE.md)
   - a test file in `tests/` (node:test + assert/strict, using fakes from `tests/fakes.ts`, no network) that fails now and passes when the step is done
4. Do NOT write the implementation.
5. End with: the files to edit, the command to run (`npm test`, `npm run ask -- "…"` etc.), and what "done" looks like. Offer hints if he gets stuck.
