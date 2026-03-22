import fs from 'fs';
const file = 'src/app/globals.css';
let content = fs.readFileSync(file, 'utf8');

// Replace @tailwind directives with @import "tailwindcss" and @theme
content = content.replace(
`@tailwind base;
@tailwind components;
@tailwind utilities;`,
`@import "tailwindcss";

@theme {
  --color-bg: var(--bg);
  --color-fg: var(--fg);
  --color-muted: var(--muted);
  --color-border: var(--border);
  --color-brand: var(--brand);
  --color-brand-contrast: var(--brand-contrast);
  --color-card: var(--card);
  --color-card-fg: var(--card-fg);
  --color-accent: var(--accent);
  --color-accent-contrast: var(--accent-contrast);
  --radius-xl: var(--radius);
  --radius-2xl: calc(var(--radius) + 6px);
  --shadow-soft: var(--shadow);
  --width-screen: var(--maxw);
}`
);

fs.writeFileSync(file, content);
