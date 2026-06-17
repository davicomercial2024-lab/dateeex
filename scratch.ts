import PocketBase from 'pocketbase';

async function main() {
  const pb = new PocketBase(process.env.NEXT_PUBLIC_POCKETBASE_URL);
  try {
    await pb.admins.authWithPassword(process.env.PB_ADMIN_EMAIL as string, process.env.PB_ADMIN_PASS as string);
    console.log("Auth success");
  } catch (e: any) {
    console.error("Auth Error:", e?.response || e);
    return;
  }

  try {
    const accounts = await pb.collection("mercado_livre_accounts").getFullList();
    console.log("Total accounts:", accounts.length);
    for (const acc of accounts) {
      console.log(`- ${acc.id} | ${acc.nickname}`);
      const listings = await pb.collection("listings").getList(1, 1, { filter: `account="${acc.id}"` });
      console.log(`  - Listings: ${listings.totalItems}`);
    }
  } catch (e: any) {
    console.error("Fetch Error:", e?.response || e);
  }
}

main();
