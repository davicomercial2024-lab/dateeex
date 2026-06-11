-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "OrganizationMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrganizationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MercadoLivreAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "meliUserId" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "nicknameCustom" TEXT,
    "email" TEXT,
    "siteId" TEXT,
    "countryId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CONNECTED',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncAt" DATETIME,
    "lastSyncStatus" TEXT,
    "lastSyncError" TEXT,
    "connectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disconnectedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MercadoLivreAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OAuthToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mercadoLivreAccountId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "scope" TEXT,
    "tokenType" TEXT DEFAULT 'bearer',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OAuthToken_mercadoLivreAccountId_fkey" FOREIGN KEY ("mercadoLivreAccountId") REFERENCES "MercadoLivreAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "mercadoLivreAccountId" TEXT NOT NULL,
    "mlItemId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "price" DECIMAL NOT NULL,
    "currencyId" TEXT NOT NULL DEFAULT 'BRL',
    "availableQuantity" INTEGER NOT NULL DEFAULT 0,
    "soldQuantity" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "permalink" TEXT,
    "thumbnail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Listing_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Listing_mercadoLivreAccountId_fkey" FOREIGN KEY ("mercadoLivreAccountId") REFERENCES "MercadoLivreAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "mercadoLivreAccountId" TEXT NOT NULL,
    "mlOrderId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "totalAmount" DECIMAL NOT NULL,
    "buyerNickname" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "dateCreated" DATETIME NOT NULL,
    "dateClosed" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Order_mercadoLivreAccountId_fkey" FOREIGN KEY ("mercadoLivreAccountId") REFERENCES "MercadoLivreAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "mlItemId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL NOT NULL,
    CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "mercadoLivreAccountId" TEXT NOT NULL,
    "mlShipmentId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "trackingNumber" TEXT,
    "trackingMethod" TEXT,
    "serviceId" TEXT,
    "dateCreated" DATETIME NOT NULL,
    "dateFirstPrinted" DATETIME,
    "dateShipped" DATETIME,
    "dateDelivered" DATETIME,
    CONSTRAINT "Shipment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "mercadoLivreAccountId" TEXT NOT NULL,
    "mlQuestionId" TEXT NOT NULL,
    "mlItemId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "answerText" TEXT,
    "answerDate" DATETIME,
    "buyerId" TEXT NOT NULL,
    "dateCreated" DATETIME NOT NULL,
    CONSTRAINT "Question_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Question_mercadoLivreAccountId_fkey" FOREIGN KEY ("mercadoLivreAccountId") REFERENCES "MercadoLivreAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "mercadoLivreAccountId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "mlClaimId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "dateCreated" DATETIME NOT NULL,
    "dateClosed" DATETIME,
    CONSTRAINT "Claim_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Claim_mercadoLivreAccountId_fkey" FOREIGN KEY ("mercadoLivreAccountId") REFERENCES "MercadoLivreAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Claim_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SellerReputation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "mercadoLivreAccountId" TEXT NOT NULL,
    "levelId" TEXT,
    "powerSellerStatus" TEXT,
    "claimsRate" DECIMAL NOT NULL,
    "delayedHandlingTimeRate" DECIMAL NOT NULL,
    "cancellationsRate" DECIMAL NOT NULL,
    "salesPeriod" TEXT NOT NULL,
    "salesCompleted" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SellerReputation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SellerReputation_mercadoLivreAccountId_fkey" FOREIGN KEY ("mercadoLivreAccountId") REFERENCES "MercadoLivreAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "mlPromotionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    CONSTRAINT "Promotion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PromotionOffer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mercadoLivreAccountId" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "originalPrice" DECIMAL NOT NULL,
    "promoPrice" DECIMAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'eligible',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PromotionOffer_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PromotionOffer_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PromotionOffer_mercadoLivreAccountId_fkey" FOREIGN KEY ("mercadoLivreAccountId") REFERENCES "MercadoLivreAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdvertisingCampaign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "mlCampaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "budget" DECIMAL NOT NULL,
    "budgetType" TEXT NOT NULL DEFAULT 'daily',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AdvertisingCampaign_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdvertisingMetric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mercadoLivreAccountId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "cost" DECIMAL NOT NULL,
    "salesAmount" DECIMAL NOT NULL,
    "salesQty" INTEGER NOT NULL DEFAULT 0,
    "acos" DECIMAL NOT NULL,
    "date" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdvertisingMetric_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "AdvertisingCampaign" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AdvertisingMetric_mercadoLivreAccountId_fkey" FOREIGN KEY ("mercadoLivreAccountId") REFERENCES "MercadoLivreAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MetricSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "mercadoLivreAccountId" TEXT,
    "salesCount" INTEGER NOT NULL DEFAULT 0,
    "revenue" DECIMAL NOT NULL DEFAULT 0.00,
    "activeListings" INTEGER NOT NULL DEFAULT 0,
    "conversionRate" DECIMAL NOT NULL DEFAULT 0.0000,
    "avgTicket" DECIMAL NOT NULL DEFAULT 0.00,
    "date" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MetricSnapshot_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MetricSnapshot_mercadoLivreAccountId_fkey" FOREIGN KEY ("mercadoLivreAccountId") REFERENCES "MercadoLivreAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AIAnalysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "mercadoLivreAccountId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "score" DECIMAL,
    "actionableSteps" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AIAnalysis_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AIAnalysis_mercadoLivreAccountId_fkey" FOREIGN KEY ("mercadoLivreAccountId") REFERENCES "MercadoLivreAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL DEFAULT 'mercadolivre',
    "topic" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "userIdMercadoLivre" TEXT,
    "applicationId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'received',
    "errorMessage" TEXT,
    "processedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mercadoLivreAccountId" TEXT
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mercadoLivreAccountId" TEXT,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "ipAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AuditLog_mercadoLivreAccountId_fkey" FOREIGN KEY ("mercadoLivreAccountId") REFERENCES "MercadoLivreAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "OrganizationMember_organizationId_idx" ON "OrganizationMember"("organizationId");

-- CreateIndex
CREATE INDEX "OrganizationMember_userId_idx" ON "OrganizationMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMember_organizationId_userId_key" ON "OrganizationMember"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "MercadoLivreAccount_organizationId_idx" ON "MercadoLivreAccount"("organizationId");

-- CreateIndex
CREATE INDEX "MercadoLivreAccount_meliUserId_idx" ON "MercadoLivreAccount"("meliUserId");

-- CreateIndex
CREATE INDEX "MercadoLivreAccount_isActive_idx" ON "MercadoLivreAccount"("isActive");

-- CreateIndex
CREATE INDEX "MercadoLivreAccount_isDefault_idx" ON "MercadoLivreAccount"("isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "MercadoLivreAccount_organizationId_meliUserId_key" ON "MercadoLivreAccount"("organizationId", "meliUserId");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthToken_mercadoLivreAccountId_key" ON "OAuthToken"("mercadoLivreAccountId");

-- CreateIndex
CREATE INDEX "OAuthToken_mercadoLivreAccountId_idx" ON "OAuthToken"("mercadoLivreAccountId");

-- CreateIndex
CREATE INDEX "Listing_organizationId_idx" ON "Listing"("organizationId");

-- CreateIndex
CREATE INDEX "Listing_mercadoLivreAccountId_idx" ON "Listing"("mercadoLivreAccountId");

-- CreateIndex
CREATE INDEX "Listing_status_idx" ON "Listing"("status");

-- CreateIndex
CREATE INDEX "Listing_mlItemId_idx" ON "Listing"("mlItemId");

-- CreateIndex
CREATE INDEX "Listing_createdAt_idx" ON "Listing"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Listing_mercadoLivreAccountId_mlItemId_key" ON "Listing"("mercadoLivreAccountId", "mlItemId");

-- CreateIndex
CREATE INDEX "Order_organizationId_idx" ON "Order"("organizationId");

-- CreateIndex
CREATE INDEX "Order_mercadoLivreAccountId_idx" ON "Order"("mercadoLivreAccountId");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_mlOrderId_idx" ON "Order"("mlOrderId");

-- CreateIndex
CREATE INDEX "Order_dateCreated_idx" ON "Order"("dateCreated");

-- CreateIndex
CREATE UNIQUE INDEX "Order_mercadoLivreAccountId_mlOrderId_key" ON "Order"("mercadoLivreAccountId", "mlOrderId");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_mlItemId_idx" ON "OrderItem"("mlItemId");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_orderId_key" ON "Shipment"("orderId");

-- CreateIndex
CREATE INDEX "Shipment_orderId_idx" ON "Shipment"("orderId");

-- CreateIndex
CREATE INDEX "Shipment_mercadoLivreAccountId_idx" ON "Shipment"("mercadoLivreAccountId");

-- CreateIndex
CREATE INDEX "Shipment_status_idx" ON "Shipment"("status");

-- CreateIndex
CREATE INDEX "Shipment_dateCreated_idx" ON "Shipment"("dateCreated");

-- CreateIndex
CREATE INDEX "Question_organizationId_idx" ON "Question"("organizationId");

-- CreateIndex
CREATE INDEX "Question_mercadoLivreAccountId_idx" ON "Question"("mercadoLivreAccountId");

-- CreateIndex
CREATE INDEX "Question_status_idx" ON "Question"("status");

-- CreateIndex
CREATE INDEX "Question_mlItemId_idx" ON "Question"("mlItemId");

-- CreateIndex
CREATE INDEX "Question_dateCreated_idx" ON "Question"("dateCreated");

-- CreateIndex
CREATE UNIQUE INDEX "Question_mercadoLivreAccountId_mlQuestionId_key" ON "Question"("mercadoLivreAccountId", "mlQuestionId");

-- CreateIndex
CREATE UNIQUE INDEX "Claim_orderId_key" ON "Claim"("orderId");

-- CreateIndex
CREATE INDEX "Claim_organizationId_idx" ON "Claim"("organizationId");

-- CreateIndex
CREATE INDEX "Claim_mercadoLivreAccountId_idx" ON "Claim"("mercadoLivreAccountId");

-- CreateIndex
CREATE INDEX "Claim_status_idx" ON "Claim"("status");

-- CreateIndex
CREATE INDEX "Claim_dateCreated_idx" ON "Claim"("dateCreated");

-- CreateIndex
CREATE UNIQUE INDEX "Claim_mercadoLivreAccountId_mlClaimId_key" ON "Claim"("mercadoLivreAccountId", "mlClaimId");

-- CreateIndex
CREATE INDEX "SellerReputation_organizationId_idx" ON "SellerReputation"("organizationId");

-- CreateIndex
CREATE INDEX "SellerReputation_mercadoLivreAccountId_idx" ON "SellerReputation"("mercadoLivreAccountId");

-- CreateIndex
CREATE INDEX "SellerReputation_createdAt_idx" ON "SellerReputation"("createdAt");

-- CreateIndex
CREATE INDEX "Promotion_organizationId_idx" ON "Promotion"("organizationId");

-- CreateIndex
CREATE INDEX "Promotion_status_idx" ON "Promotion"("status");

-- CreateIndex
CREATE INDEX "Promotion_startDate_endDate_idx" ON "Promotion"("startDate", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "Promotion_organizationId_mlPromotionId_key" ON "Promotion"("organizationId", "mlPromotionId");

-- CreateIndex
CREATE INDEX "PromotionOffer_mercadoLivreAccountId_idx" ON "PromotionOffer"("mercadoLivreAccountId");

-- CreateIndex
CREATE INDEX "PromotionOffer_promotionId_idx" ON "PromotionOffer"("promotionId");

-- CreateIndex
CREATE INDEX "PromotionOffer_listingId_idx" ON "PromotionOffer"("listingId");

-- CreateIndex
CREATE UNIQUE INDEX "PromotionOffer_promotionId_listingId_key" ON "PromotionOffer"("promotionId", "listingId");

-- CreateIndex
CREATE INDEX "AdvertisingCampaign_organizationId_idx" ON "AdvertisingCampaign"("organizationId");

-- CreateIndex
CREATE INDEX "AdvertisingCampaign_status_idx" ON "AdvertisingCampaign"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AdvertisingCampaign_organizationId_mlCampaignId_key" ON "AdvertisingCampaign"("organizationId", "mlCampaignId");

-- CreateIndex
CREATE INDEX "AdvertisingMetric_mercadoLivreAccountId_idx" ON "AdvertisingMetric"("mercadoLivreAccountId");

-- CreateIndex
CREATE INDEX "AdvertisingMetric_campaignId_idx" ON "AdvertisingMetric"("campaignId");

-- CreateIndex
CREATE INDEX "AdvertisingMetric_date_idx" ON "AdvertisingMetric"("date");

-- CreateIndex
CREATE UNIQUE INDEX "AdvertisingMetric_campaignId_date_key" ON "AdvertisingMetric"("campaignId", "date");

-- CreateIndex
CREATE INDEX "MetricSnapshot_organizationId_idx" ON "MetricSnapshot"("organizationId");

-- CreateIndex
CREATE INDEX "MetricSnapshot_mercadoLivreAccountId_idx" ON "MetricSnapshot"("mercadoLivreAccountId");

-- CreateIndex
CREATE INDEX "MetricSnapshot_date_idx" ON "MetricSnapshot"("date");

-- CreateIndex
CREATE UNIQUE INDEX "MetricSnapshot_organizationId_mercadoLivreAccountId_date_key" ON "MetricSnapshot"("organizationId", "mercadoLivreAccountId", "date");

-- CreateIndex
CREATE INDEX "AIAnalysis_organizationId_idx" ON "AIAnalysis"("organizationId");

-- CreateIndex
CREATE INDEX "AIAnalysis_mercadoLivreAccountId_idx" ON "AIAnalysis"("mercadoLivreAccountId");

-- CreateIndex
CREATE INDEX "AIAnalysis_createdAt_idx" ON "AIAnalysis"("createdAt");

-- CreateIndex
CREATE INDEX "WebhookEvent_topic_idx" ON "WebhookEvent"("topic");

-- CreateIndex
CREATE INDEX "WebhookEvent_userIdMercadoLivre_idx" ON "WebhookEvent"("userIdMercadoLivre");

-- CreateIndex
CREATE INDEX "WebhookEvent_status_idx" ON "WebhookEvent"("status");

-- CreateIndex
CREATE INDEX "WebhookEvent_createdAt_idx" ON "WebhookEvent"("createdAt");

-- CreateIndex
CREATE INDEX "WebhookEvent_mercadoLivreAccountId_idx" ON "WebhookEvent"("mercadoLivreAccountId");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_idx" ON "AuditLog"("organizationId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_mercadoLivreAccountId_idx" ON "AuditLog"("mercadoLivreAccountId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
