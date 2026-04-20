# Noto

Local-first notes app with AI-powered task extraction and calendar integration.

## Stack
- React 19 + Vite (frontend)
- Express + better-sqlite3 (server, runs locally)
- Electron (desktop shell)
- Anthropic SDK (task extraction from notes)
- Tiptap (rich text editor)

## Design System
Always read `DESIGN.md` before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match `DESIGN.md`.

Key non-negotiables from `DESIGN.md`:
- **No purple, violet, or AI-magic gradients.** Terracotta accent (`#B8451E`) only.
- **Warm paper palette** (`#FAF7F2` light / `#1A1816` dark), not cool gray.
- **Canvas/chrome type rule:** what the user wrote → iA Writer family. What the app shows → Geist / Cabinet.
  - **Canvas** (editor body, title, headings): **iA Writer Quattro**.
  - **Canvas inline `code`**: **iA Writer Mono** (sibling family to Quattro).
  - **Chrome UI** (sidebar, buttons, panel labels, suggestions): **Geist**.
  - **Chrome mono** (due dates, shortcuts, status pills, file paths, editor meta line): **Geist Mono**.
  - **Display** (brand mark, marquee, empty states): **Cabinet Grotesk**.
  - The two monos never appear on the same surface — iA Mono lives only in the canvas, Geist Mono lives only in the chrome.
- **Self-host all five fonts** in `public/fonts/`. No CDN. Local-first ethos requires offline-first font loading.
- **No sparkle/star/wand icons for AI.** Quiet pulse on status dot only.
- **3-pane layout** preserved: sidebar 240px / editor flex / task panel 320px.

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
