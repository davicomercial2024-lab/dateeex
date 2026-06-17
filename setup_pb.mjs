import PocketBase from 'pocketbase';

const pb = new PocketBase('http://crar5r5c8bymozy.pb.cristianbbdi.cloud:7080');

async function createCollections() {
  await pb.admins.authWithPassword('bbbaterias@bbdi.com.br', 'diev1pn4753ikpf');

  // Organizations
  try {
    await pb.collections.create({
      name: 'organizations',
      type: 'base',
      system: false,
      schema: [
        { name: 'name', type: 'text', required: true },
        { name: 'cnpj', type: 'text', required: false },
        { name: 'plan', type: 'text', required: true },
      ],
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != ""',
      deleteRule: null,
    });
    console.log('Created organizations');
  } catch (e) { console.error('organizations:', e.response?.data); }

  // users base collection
  try {
    const usersColl = await pb.collections.getOne('users');
    await pb.collections.update('users', {
      schema: [
        ...usersColl.schema,
        { name: 'currentOrganizationId', type: 'relation', required: false, options: { collectionId: 'organizations', maxSelect: 1 } },
      ]
    });
    console.log('Updated users');
  } catch (e) { console.error('users:', e.response?.data); }

  // Organization Members
  try {
    await pb.collections.create({
      name: 'organization_members',
      type: 'base',
      system: false,
      schema: [
        { name: 'organization', type: 'relation', required: true, options: { collectionId: 'organizations', maxSelect: 1 } },
        { name: 'user', type: 'relation', required: true, options: { collectionId: 'users', maxSelect: 1 } },
        { name: 'role', type: 'text', required: true },
      ],
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != ""',
      deleteRule: '@request.auth.id != ""',
    });
    console.log('Created organization_members');
  } catch (e) { console.error('organization_members:', e.response?.data); }

  // Mercado Livre Accounts
  try {
    await pb.collections.create({
      name: 'mercado_livre_accounts',
      type: 'base',
      system: false,
      schema: [
        { name: 'organization', type: 'relation', required: true, options: { collectionId: 'organizations', maxSelect: 1 } },
        { name: 'meliUserId', type: 'text', required: true },
        { name: 'nickname', type: 'text', required: false },
        { name: 'nicknameCustom', type: 'text', required: false },
        { name: 'email', type: 'text', required: false },
        { name: 'isDefault', type: 'bool', required: false },
        { name: 'isActive', type: 'bool', required: false },
        { name: 'status', type: 'text', required: false },
      ],
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != ""',
      deleteRule: '@request.auth.id != ""',
    });
    console.log('Created mercado_livre_accounts');
  } catch (e) { console.error('mercado_livre_accounts:', e.response?.data); }

  // OAuth Tokens
  try {
    await pb.collections.create({
      name: 'oauth_tokens',
      type: 'base',
      system: false,
      schema: [
        { name: 'account', type: 'relation', required: true, options: { collectionId: 'mercado_livre_accounts', maxSelect: 1 } },
        { name: 'accessToken', type: 'text', required: true },
        { name: 'refreshToken', type: 'text', required: true },
        { name: 'expiresAt', type: 'date', required: true },
      ],
      listRule: null,
      viewRule: null,
      createRule: null,
      updateRule: null,
      deleteRule: null,
    });
    console.log('Created oauth_tokens');
  } catch (e) { console.error('oauth_tokens:', e.response?.data); }

  // Audit Logs
  try {
    await pb.collections.create({
      name: 'audit_logs',
      type: 'base',
      system: false,
      schema: [
        { name: 'organization', type: 'relation', required: true, options: { collectionId: 'organizations', maxSelect: 1 } },
        { name: 'user', type: 'relation', required: true, options: { collectionId: 'users', maxSelect: 1 } },
        { name: 'action', type: 'text', required: true },
        { name: 'details', type: 'text', required: false },
        { name: 'ipAddress', type: 'text', required: false },
      ],
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: null,
      updateRule: null,
      deleteRule: null,
    });
    console.log('Created audit_logs');
  } catch (e) { console.error('audit_logs:', e.response?.data); }
}

createCollections().catch(console.error);
