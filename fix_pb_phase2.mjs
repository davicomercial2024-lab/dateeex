import PocketBase from 'pocketbase';
const pb = new PocketBase('http://crar5r5c8bymozy.pb.cristianbbdi.cloud:7080');

async function phase2() {
  await pb.admins.authWithPassword('bbbaterias@bbdi.com.br', 'diev1pn4753ikpf');

  const orgColl = await pb.collections.getOne('organizations');
  const orgId = orgColl.id;

  const meliColl = await pb.collections.getOne('mercado_livre_accounts');
  const meliId = meliColl.id;

  const createCollection = async (name, customFields) => {
    try {
      await pb.collections.create({
        name,
        type: 'base',
        system: false,
        fields: [
          // PocketBase auto-generates id, created, updated for base collections unless we explicitly pass them
          ...customFields
        ],
        listRule: '@request.auth.id != ""',
        viewRule: '@request.auth.id != ""',
        createRule: '@request.auth.id != ""',
        updateRule: '@request.auth.id != ""',
        deleteRule: '@request.auth.id != ""',
      });
      console.log(`Created ${name}`);
    } catch (e) {
      console.error(`Error creating ${name}:`, JSON.stringify(e?.response?.data || e.message, null, 2));
    }
  };

  await createCollection('listings', [
    { name: 'organization', type: 'relation', required: true, collectionId: orgId, maxSelect: 1 },
    { name: 'account', type: 'relation', required: true, collectionId: meliId, maxSelect: 1 },
    { name: 'mlItemId', type: 'text', required: true },
    { name: 'title', type: 'text', required: true },
    { name: 'price', type: 'number', required: true },
    { name: 'availableQuantity', type: 'number', required: true },
    { name: 'soldQuantity', type: 'number', required: true },
    { name: 'condition', type: 'text', required: false },
    { name: 'permalink', type: 'text', required: false },
    { name: 'thumbnail', type: 'text', required: false },
    { name: 'status', type: 'text', required: true },
    { name: 'catalogProductId', type: 'text', required: false },
    { name: 'health', type: 'number', required: false },
    { name: 'visits', type: 'number', required: true } // mapped from views
  ]);

  const listingsColl = await pb.collections.getOne('listings');
  const listingId = listingsColl.id;

  await createCollection('orders', [
    { name: 'organization', type: 'relation', required: true, collectionId: orgId, maxSelect: 1 },
    { name: 'account', type: 'relation', required: true, collectionId: meliId, maxSelect: 1 },
    { name: 'mlOrderId', type: 'text', required: true },
    { name: 'status', type: 'text', required: true },
    { name: 'dateCreated', type: 'date', required: true },
    { name: 'totalAmount', type: 'number', required: true },
    { name: 'currencyId', type: 'text', required: false },
    { name: 'buyerNickname', type: 'text', required: false },
    { name: 'itemCount', type: 'number', required: false },
  ]);

  await createCollection('questions', [
    { name: 'organization', type: 'relation', required: true, collectionId: orgId, maxSelect: 1 },
    { name: 'account', type: 'relation', required: true, collectionId: meliId, maxSelect: 1 },
    { name: 'mlQuestionId', type: 'text', required: true },
    { name: 'itemId', type: 'text', required: true },
    { name: 'status', type: 'text', required: true },
    { name: 'text', type: 'text', required: true },
    { name: 'answer', type: 'text', required: false },
    { name: 'dateCreated', type: 'date', required: true },
  ]);

  await createCollection('claims', [
    { name: 'organization', type: 'relation', required: true, collectionId: orgId, maxSelect: 1 },
    { name: 'account', type: 'relation', required: true, collectionId: meliId, maxSelect: 1 },
    { name: 'mlClaimId', type: 'text', required: true },
    { name: 'resourceId', type: 'text', required: true },
    { name: 'type', type: 'text', required: true },
    { name: 'stage', type: 'text', required: true },
    { name: 'status', type: 'text', required: true },
    { name: 'dateCreated', type: 'date', required: true },
  ]);

  await createCollection('seller_reputations', [
    { name: 'organization', type: 'relation', required: true, collectionId: orgId, maxSelect: 1 },
    { name: 'account', type: 'relation', required: true, collectionId: meliId, maxSelect: 1 },
    { name: 'levelId', type: 'text', required: false },
    { name: 'powerSellerStatus', type: 'text', required: false },
    { name: 'transactionsTotal', type: 'number', required: false },
    { name: 'transactionsCompleted', type: 'number', required: false },
    { name: 'transactionsCanceled', type: 'number', required: false },
    { name: 'metricsSalesCompleted', type: 'number', required: false },
  ]);

  await createCollection('promotions', [
    { name: 'organization', type: 'relation', required: true, collectionId: orgId, maxSelect: 1 },
    { name: 'mlPromotionId', type: 'text', required: true },
    { name: 'name', type: 'text', required: true },
    { name: 'type', type: 'text', required: true },
    { name: 'status', type: 'text', required: true },
    { name: 'startDate', type: 'date', required: true },
    { name: 'endDate', type: 'date', required: true },
  ]);

  const promColl = await pb.collections.getOne('promotions');
  const promId = promColl.id;

  await createCollection('promotion_offers', [
    { name: 'account', type: 'relation', required: true, collectionId: meliId, maxSelect: 1 },
    { name: 'promotion', type: 'relation', required: true, collectionId: promId, maxSelect: 1 },
    { name: 'listing', type: 'relation', required: true, collectionId: listingId, maxSelect: 1 },
    { name: 'originalPrice', type: 'number', required: true },
    { name: 'promoPrice', type: 'number', required: true },
    { name: 'status', type: 'text', required: false }
  ]);

  await createCollection('advertising_campaigns', [
    { name: 'organization', type: 'relation', required: true, collectionId: orgId, maxSelect: 1 },
    { name: 'mlCampaignId', type: 'text', required: true },
    { name: 'name', type: 'text', required: true },
    { name: 'status', type: 'text', required: true },
    { name: 'budget', type: 'number', required: true },
    { name: 'budgetType', type: 'text', required: true },
  ]);

  const adColl = await pb.collections.getOne('advertising_campaigns');
  const adId = adColl.id;

  await createCollection('advertising_metrics', [
    { name: 'account', type: 'relation', required: true, collectionId: meliId, maxSelect: 1 },
    { name: 'campaign', type: 'relation', required: true, collectionId: adId, maxSelect: 1 },
    { name: 'clicks', type: 'number', required: true },
    { name: 'impressions', type: 'number', required: true },
    { name: 'cost', type: 'number', required: true },
    { name: 'salesAmount', type: 'number', required: true },
    { name: 'salesQty', type: 'number', required: true },
    { name: 'acos', type: 'number', required: true },
    { name: 'date', type: 'date', required: true }
  ]);

  await createCollection('metric_snapshots', [
    { name: 'organization', type: 'relation', required: true, collectionId: orgId, maxSelect: 1 },
    { name: 'account', type: 'relation', required: false, collectionId: meliId, maxSelect: 1 },
    { name: 'date', type: 'date', required: true },
    { name: 'revenue', type: 'number', required: true },
    { name: 'ordersCount', type: 'number', required: true },
    { name: 'avgTicket', type: 'number', required: true },
    { name: 'activeListings', type: 'number', required: true },
    { name: 'questionsCount', type: 'number', required: true },
    { name: 'claimsCount', type: 'number', required: true },
    { name: 'adSpend', type: 'number', required: true },
    { name: 'adRevenue', type: 'number', required: true },
    { name: 'acos', type: 'number', required: true }
  ]);

  await createCollection('ai_analyses', [
    { name: 'organization', type: 'relation', required: true, collectionId: orgId, maxSelect: 1 },
    { name: 'account', type: 'relation', required: true, collectionId: meliId, maxSelect: 1 },
    { name: 'listing', type: 'relation', required: false, collectionId: listingId, maxSelect: 1 },
    { name: 'type', type: 'text', required: true },
    { name: 'content', type: 'text', required: true }, // JSON as text or plain text
    { name: 'status', type: 'text', required: true },
  ]);

  await createCollection('webhook_events', [
    { name: 'provider', type: 'text', required: true },
    { name: 'topic', type: 'text', required: true },
    { name: 'resource', type: 'text', required: true },
    { name: 'userIdMercadoLivre', type: 'text', required: false },
    { name: 'applicationId', type: 'text', required: false },
    { name: 'attempts', type: 'number', required: false },
    { name: 'payload', type: 'json', required: true }, // PocketBase JSON field!
    { name: 'status', type: 'text', required: true },
  ]);

}

phase2().catch(console.error);
