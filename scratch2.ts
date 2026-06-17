import { pbAdmin } from "./src/lib/pb";
import { MercadoLivreApiService } from "./src/services/mercado-livre-api.service";
import { MercadoLivreSyncService } from "./src/services/mercado-livre-sync.service";

async function main() {
  pbAdmin.autoCancellation(false);
  
  await pbAdmin.admins.authWithPassword(
    process.env.PB_ADMIN_EMAIL as string,
    process.env.PB_ADMIN_PASS as string
  );

  const orgId = "y93wex933m9dhmv"; // Rayotek or bestbattery?
  const accounts = await pbAdmin.collection("mercado_livre_accounts").getFullList();
  
  for (const acc of accounts) {
    if (acc.nickname === "RAYOTEK") continue; // Just test the other one
    console.log(`Testing account: ${acc.nickname}`);
    try {
      console.log("Syncing Listings at offset 400...");
      await MercadoLivreSyncService.syncListingsChunk(acc.id, acc.organization, 400, 50);
      console.log("Syncing Listings at offset 450...");
      await MercadoLivreSyncService.syncListingsChunk(acc.id, acc.organization, 450, 50);
      console.log("Syncing Listings at offset 500...");
      await MercadoLivreSyncService.syncListingsChunk(acc.id, acc.organization, 500, 50);
      console.log("SUCCESS!");
    } catch (e: any) {
      console.error("Error during sync:", e?.response?.data || e);
    }
  }
}

main().catch(console.error);
