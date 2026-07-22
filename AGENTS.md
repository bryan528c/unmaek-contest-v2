# Codex Project Rules

## Project
- Name: 언맥: 잇는 자 — 기술 검증
- Stack: React + TypeScript + Vite + Phaser 3
- User is a beginner. Explain all manual verification steps.

## Architecture
- src/core: pure deterministic battle rules. No React or Phaser imports.
- src/bridge: normalized-coordinate contract between React and Phaser.
- src/phaser: actors, effects, camera, audio only.
- React: UI, drag interaction, preview, screen flow.
- Phaser must not decide damage, cost, win, or loss.

## Rules
- Do not add dependencies without explicit approval.
- Do not edit unrelated files.
- Do not use `any`.
- Preserve 16:9 responsive scaling.
- Pixel art config must keep pixelArt and roundPixels enabled.
- After changes run `npm test` and `npm run build`.
- API keys and .env files must never be committed.
