import { pbAdmin } from "./src/lib/pb";

async function main() {
  await pbAdmin.admins.authWithPassword(
    process.env.PB_ADMIN_EMAIL as string,
    process.env.PB_ADMIN_PASS as string
  );

  const collection = await pbAdmin.collections.getOne("listings");
  const fields = collection.fields || collection.schema;
  for (const field of fields) {
    if (field.type === "relation") {
      console.log(`Relation field: ${field.name}`);
    }
  }
}

main().catch(console.error);
