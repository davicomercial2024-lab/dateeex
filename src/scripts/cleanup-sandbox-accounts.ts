import "dotenv/config";
import { prisma } from "../lib/prisma";

async function main() {
  console.log("🔍 Buscando contas com tokens mock/sandbox...");

  const mockTokens = await prisma.oAuthToken.findMany({
    where: { accessToken: { contains: "mock-token" } },
    include: { mercadoLivreAccount: { select: { id: true, nickname: true, meliUserId: true, status: true } } },
  });

  console.log(`📋 Encontradas ${mockTokens.length} conta(s) sandbox.`);
  for (const token of mockTokens) {
    const acc = token.mercadoLivreAccount;
    console.log(`🗑️  Deletando: ${acc.nickname} (meliUserId: ${acc.meliUserId})`);
    await prisma.mercadoLivreAccount.delete({ where: { id: acc.id } });
    console.log(`   ✅ Deletada.`);
  }

  const orphans = await prisma.mercadoLivreAccount.findMany({ where: { token: null } });
  console.log(`📋 Contas sem token: ${orphans.length}`);
  for (const acc of orphans) {
    console.log(`🗑️  Deletando sem token: ${acc.nickname} (${acc.meliUserId})`);
    await prisma.mercadoLivreAccount.delete({ where: { id: acc.id } });
    console.log(`   ✅ Deletada.`);
  }

  const remaining = await prisma.mercadoLivreAccount.findMany({
    include: { token: { select: { expiresAt: true } } },
  });
  console.log(`\n📊 Contas restantes após limpeza: ${remaining.length}`);
  remaining.forEach((acc) =>
    console.log(`   - ${acc.nickname} (${acc.meliUserId}) | Status: ${acc.status}`)
  );
}

main()
  .catch((e) => { console.error("❌ Erro:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
