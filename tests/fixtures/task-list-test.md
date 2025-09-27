# Task List Test

This is a test to verify that task lists render properly in the TipTap editor.

## Basic Task List

- [x] Completed task with **bold text**
- [ ] Incomplete task with *italic text*
- [x] Another completed task with `inline code`

## Nested Task Lists

- [x] Parent task completed
  - [x] Nested completed task
  - [ ] Nested incomplete task with longer text that should wrap properly and align with the checkbox
- [ ] Parent task incomplete
  - [x] Nested completed under incomplete parent
  - [ ] Another nested task
    - [x] Third level nesting
    - [ ] Third level incomplete with even longer text that definitely should wrap and test our alignment

## Mixed Content

- [x] Task with a paragraph

  This is a paragraph inside a task item.

- [ ] Task with a list
  - Regular bullet point inside task
  - Another bullet point

- [x] Task with links: [OpenAI](https://openai.com) and code: `pnpm dev`