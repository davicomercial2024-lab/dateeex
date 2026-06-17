import { pbAdmin } from "./src/lib/pb";
import { MercadoLivreSyncService } from "./src/services/mercado-livre-sync.service";

async function main() {
  await pbAdmin.admins.authWithPassword(
    process.env.PB_ADMIN_EMAIL as string,
    process.env.PB_ADMIN_PASS as string
  );

  const orgId = "y93wex933m9dhmv"; // test org
  const accounts = await pbAdmin.collection("mercado_livre_accounts").getFullList();
  
  const acc = accounts.find(a => a.nickname !== "RAYOTEK");
  if (!acc) return;

  console.log(`Testing account: ${acc.nickname}`);
  
  const promises = [];
  for (let i = 0; i < 500; i++) {
    promises.push(
      MercadoLivreSyncService.getAccountAndToken(acc.id, acc.organization).catch(e => {
        console.error("Error at iteration", i, e.message);
        throw e;
      })
    );
  }

  try {
    await Promise.all(promises);
    console.log("SUCCESS!");
  } catch (e: any) {
    console.error("Failed:", e.message);
  }
}

main().catch(console.error);
