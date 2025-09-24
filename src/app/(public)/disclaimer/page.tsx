// SPDX-License-Identifier: Apache-2.0
import { ConfigServiceImpl } from "@/lib/config";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";

export default async function DisclaimerPage() {
  const config = new ConfigServiceImpl({ db });
  const enabled = await config.getBoolean("SITE.DISCLAIMER.ENABLED");

  if (!enabled) {
    notFound();
  }

  const text = await config.getString("SITE.DISCLAIMER.TEXT");
  const style = await config.getString("SITE.DISCLAIMER.STYLE");

  return (
    <div className="prose dark:prose-invert mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      <style>{style}</style>
      <h1>Disclaimer</h1>
      <div dangerouslySetInnerHTML={{ __html: text ?? "" }} />
    </div>
  );
}
