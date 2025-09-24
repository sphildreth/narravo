// SPDX-License-Identifier: Apache-2.0
import { ConfigService, ConfigServiceImpl } from "@/lib/config";
import { sanitizeHtml } from "@/lib/sanitize";

async function AboutMe() {
  const config: ConfigService = new ConfigServiceImpl();

  const enabled = await config.getBoolean("SITE.ABOUT-ME.ENABLED");

  if (!enabled) {
    return null;
  }

  const title = await config.getString("SITE.ABOUT-ME.TITLE");
  const content = await config.getString("SITE.ABOUT-ME.CONTENT");
  const safeHtml = sanitizeHtml(content || "");

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted mb-2">{title}</h3>
      <div className="text-sm text-fg-muted" dangerouslySetInnerHTML={{ __html: safeHtml }} />
    </section>
  );
}

export default AboutMe;
