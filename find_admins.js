const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const admins = await prisma.organizationMember.findMany({
    where: { role: 'ADMIN' },
    include: {
      user: true,
      organization: true
    }
  });

  if (admins.length > 0) {
    console.log("Encontrados administradores:");
    admins.forEach(admin => {
      console.log(`- Nome: ${admin.user.name} | E-mail: ${admin.user.email} | Organização: ${admin.organization.name}`);
    });
  } else {
    console.log("Nenhum administrador encontrado no banco de dados.");
  }
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
