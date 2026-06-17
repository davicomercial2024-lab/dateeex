import { pbAdmin } from "./src/lib/pb";
import { MercadoLivreSyncService } from "./src/services/mercado-livre-sync.service";

async function main() {
  await pbAdmin.admins.authWithPassword(
    process.env.PB_ADMIN_EMAIL as string,
    process.env.PB_ADMIN_PASS as string
  );

  const orgId = "y93wex933m9dhmv"; // test org
  const accounts = await pbAdmin.collection("mercado_livre_accounts").getFullList();
  
  const acc = accounts.find(a => a.nickname === "BESTBATTERY_BBDI_DISTRIBUIDORA" || a.id === "181903184");
  if (!acc) {
    console.log("Account not found");
    return;
  }

  console.log(`Starting full sync for account: ${acc.nickname}`);
  
  // Listings
  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    console.log(`Syncing listings offset ${offset}...`);
    try {
      const result = await MercadoLivreSyncService.syncListingsChunk(acc.id, acc.organization, offset, 50);
      hasMore = result.hasMore;
      offset += 50;
    } catch (e: any) {
      console.error(`Error at listings offset ${offset}:`, e.message);
      // continue anyway to see if it recovers
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  // Orders
  offset = 0;
  hasMore = true;
  while (hasMore) {
    console.log(`Syncing orders offset ${offset}...`);
    try {
      const result = await MercadoLivreSyncService.syncOrdersChunk(acc.id, acc.organization, offset, 50);
      hasMore = result.hasMore;
      offset += 50;
    } catch (e: any) {
      console.error(`Error at orders offset ${offset}:`, e.message);
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  // Questions
  offset = 0;
  hasMore = true;
  while (hasMore) {
    console.log(`Syncing questions offset ${offset}...`);
    try {
      const result = await MercadoLivreSyncService.syncQuestionsChunk(acc.id, acc.organization, offset, 50);
      hasMore = result.hasMore;
      offset += 50;
    } catch (e: any) {
      console.error(`Error at questions offset ${offset}:`, e.message);
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  await pbAdmin.collection("mercado_livre_accounts").update(acc.id, {
    lastSyncStatus: "SUCCESS",
    lastSyncAt: new Date().toISOString()
  });

  console.log("Sync complete!");
}

main().catch(console.error);
