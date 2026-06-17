import { pbAdmin } from "./src/lib/pb";
import { MercadoLivreSyncService } from "./src/services/mercado-livre-sync.service";
import { MercadoLivreApiService } from "./src/services/mercado-livre-api.service";

async function main() {
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
      const { account, token } = await MercadoLivreSyncService.getAccountAndToken(acc.id, acc.organization);
      
      console.log("Fetching orders chunk 0...");
      await MercadoLivreApiService.fetchOrdersChunk(account.meliUserId, token.accessToken, 0, 50);

      console.log("Fetching questions chunk 0...");
      await MercadoLivreApiService.fetchQuestionsChunk(account.meliUserId, token.accessToken, 0, 50);

      console.log("SUCCESS!");
    } catch (e: any) {
      console.error("Error during sync:", e?.message || e);
    }
  }
}

main().catch(console.error);
