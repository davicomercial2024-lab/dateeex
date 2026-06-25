import { NextResponse } from "next/server";
import { pbAdmin } from "@/lib/pb";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await pbAdmin.admins.authWithPassword(process.env.PB_ADMIN_EMAIL as string, process.env.PB_ADMIN_PASS as string);
    const orgs = await pbAdmin.collection('organizations').getFullList();
    const lCount = await pbAdmin.collection("listings").getList(1, 1).catch(e => e.message);
    const oCount = await pbAdmin.collection("orders").getList(1, 1).catch(e => e.message);

    const lSchema = await pbAdmin.collections.getOne("listings").catch(e => e.message);

    return NextResponse.json({
      orgs: orgs.length,
      listings: lCount,
      orders: oCount,
      schema: lSchema.schema ? lSchema.schema.map((f:any) => f.name + ":" + f.type) : lSchema
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
