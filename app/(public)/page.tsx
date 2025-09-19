import ThemeToggle from "../../components/ThemeToggle";
import { cookies } from "next/headers";

export const revalidate = 60;

export default function Home() {
  const themeCookie = cookies().get("theme")?.value;
  const initialTheme = themeCookie === "dark" ? "dark" : "light";

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-3xl font-semibold text-fg">Narravo</h1>
          <p className="text-sm text-muted">Next.js + Postgres + Drizzle</p>
        </div>
        <ThemeToggle initialTheme={initialTheme} />
      </header>

      <section className="prose">
        <p>
          Narravo ships with a themeable design system. Try the toggle to switch between light and dark
          appearances and note how tokens cascade through typography, borders, and accents.
        </p>
        <blockquote>
          Cohesive theming keeps focus on the story instead of the UI chrome—small touches compound.
        </blockquote>
        <p>
          Run <code>pnpm dev</code> to start the app and explore components styled with Tailwind utilities like
          <code>bg-brand</code> and <code>text-accent</code>.
        </p>
      </section>
    </main>
  );
}
