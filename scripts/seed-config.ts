import { ConfigServiceImpl } from "../lib/config";
import { db } from "../lib/db";

async function main() {
  // Seed the default cache TTL (integer, minutes) with value 5
  const service = new ConfigServiceImpl({ db });
  await service.setGlobal("SYSTEM.CACHE.DEFAULT-TTL", 5, { type: "integer", required: false });
  // You can add more required global keys here in the future
  // e.g., await configService.setGlobal('SYSTEM.SITE.TITLE', 'Narravo', { type: 'string', required: true });
}

main()
  .then(() => {
    console.log("Seeded configuration defaults.");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
