import PocketBase from 'pocketbase';
const pb = new PocketBase('http://crar5r5c8bymozy.pb.cristianbbdi.cloud:7080');

async function fix() {
  await pb.admins.authWithPassword('bbbaterias@bbdi.com.br', 'diev1pn4753ikpf');

  // Apagar todos os records existentes (para evitar inconsistencias)
  const users = await pb.collection('users').getFullList();
  for (const u of users) await pb.collection('users').delete(u.id);

  const orgs = await pb.collection('organizations').getFullList();
  for (const o of orgs) await pb.collection('organizations').delete(o.id);

  const updateFields = async (name, fields) => {
    try {
      const coll = await pb.collections.getOne(name);
      await pb.collections.update(coll.id, { fields: [...coll.fields.filter(f => f.name === 'id' || f.system), ...fields] });
      console.log(`Updated ${name}`);
    } catch (e) {
      console.error(`Error updating ${name}:`, JSON.stringify(e?.response?.data || e.message, null, 2));
    }
  };

  const orgColl = await pb.collections.getOne('organizations');
  const orgId = orgColl.id;

  const usersColl = await pb.collections.getOne('users');
  const usersId = usersColl.id;

  const meliColl = await pb.collections.getOne('mercado_livre_accounts');
  const meliId = meliColl.id;

  await updateFields('organizations', [
    { name: 'name', type: 'text', required: true },
    { name: 'cnpj', type: 'text', required: false },
    { name: 'plan', type: 'text', required: true },
  ]);

  await updateFields('organization_members', [
    { name: 'organization', type: 'relation', required: true, collectionId: orgId, maxSelect: 1 },
    { name: 'user', type: 'relation', required: true, collectionId: usersId, maxSelect: 1 },
    { name: 'role', type: 'text', required: true },
  ]);

  await updateFields('mercado_livre_accounts', [
    { name: 'organization', type: 'relation', required: true, collectionId: orgId, maxSelect: 1 },
    { name: 'meliUserId', type: 'text', required: true },
    { name: 'nickname', type: 'text', required: false },
    { name: 'nicknameCustom', type: 'text', required: false },
    { name: 'email', type: 'text', required: false },
    { name: 'isDefault', type: 'bool', required: false },
    { name: 'isActive', type: 'bool', required: false },
    { name: 'status', type: 'text', required: false },
  ]);

  await updateFields('oauth_tokens', [
    { name: 'account', type: 'relation', required: true, collectionId: meliId, maxSelect: 1 },
    { name: 'accessToken', type: 'text', required: true },
    { name: 'refreshToken', type: 'text', required: true },
    { name: 'expiresAt', type: 'date', required: true },
  ]);

  await updateFields('audit_logs', [
    { name: 'organization', type: 'relation', required: true, collectionId: orgId, maxSelect: 1 },
    { name: 'user', type: 'relation', required: true, collectionId: usersId, maxSelect: 1 },
    { name: 'action', type: 'text', required: true },
    { name: 'details', type: 'text', required: false },
    { name: 'ipAddress', type: 'text', required: false },
  ]);

}

fix().catch(console.error);
