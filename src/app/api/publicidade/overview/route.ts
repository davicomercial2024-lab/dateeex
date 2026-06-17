import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { pbAdmin } from "@/lib/pb";
import { verifyToken } from "@/lib/auth";
import {
  PublicidadeApiService,
  AdvertisingAdvertiser,
  ProductAdsCampaign,
  ProductAdsItem,
  BrandAdsCampaign,
  DisplayCampaign,
  DisplayLineItem,
  Bonification,
} from "@/services/publicidade-api.service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ProductId = "PADS" | "BADS" | "DISPLAY";

const PRODUCTS: ProductId[] = ["PADS", "BADS", "DISPLAY"];

function toNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function toString(value: unknown, fallback = "") {
  return typeof value === "string" && value ? value : fallback;
}

function todayValue() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function campaignMetrics(source: ProductAdsCampaign | BrandAdsCampaign | DisplayCampaign | any) {
  return source?.metrics_summary || source?.metrics || {};
}

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("datex_session")?.value;

    if (!token) {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }

    const session = await verifyToken(token);
    if (!session) {
      return NextResponse.json({ error: "Sessao invalida." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId") || "all";
    const dateFrom = searchParams.get("dateFrom") || daysAgo(30);
    const dateTo = searchParams.get("dateTo") || todayValue();
    const status = searchParams.get("status") || "all";
    const recommendedOnly = searchParams.get("recommendedOnly") === "true";
    const productCampaignId = searchParams.get("productCampaignId") || "";
    const brandCampaignId = searchParams.get("brandCampaignId") || "";
    const displayCampaignId = searchParams.get("displayCampaignId") || "";

    let filter = `organization = "${session.orgId}" && isActive = true && status = "CONNECTED"`;
    if (accountId && accountId !== "all") {
      filter += ` && id = "${accountId}"`;
    }

    const pbAccounts = await pbAdmin.collection("mercado_livre_accounts").getFullList({
      filter,
      sort: "-isDefault,nickname",
    });

    const accountIds = pbAccounts.map(a => a.id);
    let tokens: any[] = [];
    if (accountIds.length > 0) {
      const tokensFilter = accountIds.map(id => `account = "${id}"`).join(" || ");
      tokens = await pbAdmin.collection("oauth_tokens").getFullList({ filter: tokensFilter });
    }

    const accounts = pbAccounts.map(acc => ({
      ...acc,
      token: tokens.find(t => t.account === acc.id) || null
    }));

    const accountSummaries: Array<{
      id: string;
      displayName: string;
      siteId: string | null;
      products: Record<
        ProductId,
        {
          advertisers: number;
          campaigns: number;
          ads: number;
          available: boolean;
          error?: string;
        }
      >;
    }> = [];

    const advertiserIndex = {
      PADS: [] as Array<{ accountId: string; accountLabel: string; advertiser: AdvertisingAdvertiser }>,
      BADS: [] as Array<{ accountId: string; accountLabel: string; advertiser: AdvertisingAdvertiser }>,
      DISPLAY: [] as Array<{ accountId: string; accountLabel: string; advertiser: AdvertisingAdvertiser }>,
    };

    const productCampaigns: Array<
      ProductAdsCampaign & {
        accountId: string;
        accountLabel: string;
        advertiserId: number;
        advertiserSiteId: string;
        advertiserName: string;
      }
    > = [];
    const productAds: Array<
      ProductAdsItem & {
        accountId: string;
        accountLabel: string;
        advertiserId: number;
        advertiserSiteId: string;
        advertiserName: string;
      }
    > = [];
    const brandCampaigns: Array<
      BrandAdsCampaign & {
        accountId: string;
        accountLabel: string;
        advertiserId: number;
        advertiserSiteId: string;
        advertiserName: string;
      }
    > = [];
    const displayCampaigns: Array<
      DisplayCampaign & {
        accountId: string;
        accountLabel: string;
        advertiserId: number;
        advertiserSiteId: string;
        advertiserName: string;
      }
    > = [];

    const bonificationsByAccount: Array<{
      accountId: string;
      accountLabel: string;
      bonifications: Bonification[];
    }> = [];
    const errors: Array<{ accountId: string; accountName: string; product: string; message: string }> = [];

    for (const account of accounts) {
      const accountLabel = (account as any).nicknameCustom || (account as any).nickname;
      const accountSummary = {
        id: account.id,
        displayName: accountLabel,
        siteId: (account as any).siteId,
        products: {
          PADS: { advertisers: 0, campaigns: 0, ads: 0, available: false },
          BADS: { advertisers: 0, campaigns: 0, ads: 0, available: false },
          DISPLAY: { advertisers: 0, campaigns: 0, ads: 0, available: false },
        } as Record<
          ProductId,
          {
            advertisers: number;
            campaigns: number;
            ads: number;
            available: boolean;
            error?: string;
          }
        >,
      };

      for (const product of PRODUCTS) {
        if (!account.token) {
          accountSummary.products[product] = {
            advertisers: 0,
            campaigns: 0,
            ads: 0,
            available: false,
            error: "Conta sem token OAuth.",
          };
          continue;
        }

        try {
          const advertisers = await PublicidadeApiService.fetchAdvertisingAdvertisers(
            account.token.accessToken,
            product
          );

          accountSummary.products[product] = {
            advertisers: advertisers.length,
            campaigns: 0,
            ads: 0,
            available: advertisers.length > 0,
          };

          advertisers.forEach((advertiser) => {
            advertiserIndex[product].push({
              accountId: account.id,
              accountLabel,
              advertiser,
            });
          });

          if (product === "PADS") {
            for (const advertiser of advertisers) {
              const campaignResponse = await PublicidadeApiService.fetchProductAdsCampaigns({
                accessToken: account.token.accessToken,
                advertiserSiteId: advertiser.site_id,
                advertiserId: advertiser.advertiser_id,
                dateFrom,
                dateTo,
                status,
                metricsSummary: true,
              });

              accountSummary.products.PADS.campaigns += campaignResponse.results.length;

              for (const campaign of campaignResponse.results) {
                productCampaigns.push({
                  ...campaign,
                  accountId: account.id,
                  accountLabel,
                  advertiserId: advertiser.advertiser_id,
                  advertiserSiteId: advertiser.site_id,
                  advertiserName: advertiser.advertiser_name,
                });
              }

              const adsResponse = await PublicidadeApiService.fetchProductAds({
                accessToken: account.token.accessToken,
                advertiserSiteId: advertiser.site_id,
                advertiserId: advertiser.advertiser_id,
                dateFrom,
                dateTo,
                status,
                recommendedOnly,
              });

              accountSummary.products.PADS.ads += adsResponse.results.length;

              for (const ad of adsResponse.results) {
                productAds.push({
                  ...ad,
                  accountId: account.id,
                  accountLabel,
                  advertiserId: advertiser.advertiser_id,
                  advertiserSiteId: advertiser.site_id,
                  advertiserName: advertiser.advertiser_name,
                });
              }
            }
          }

          if (product === "BADS") {
            for (const advertiser of advertisers) {
              const brandResponse = await PublicidadeApiService.fetchBrandAdsCampaigns({
                accessToken: account.token.accessToken,
                advertiserId: advertiser.advertiser_id,
              });

              accountSummary.products.BADS.campaigns += brandResponse.results.length;
              brandResponse.results.forEach((campaign) => {
                brandCampaigns.push({
                  ...campaign,
                  accountId: account.id,
                  accountLabel,
                  advertiserId: advertiser.advertiser_id,
                  advertiserSiteId: advertiser.site_id,
                  advertiserName: advertiser.advertiser_name,
                });
              });
            }
          }

          if (product === "DISPLAY") {
            for (const advertiser of advertisers) {
              const displayResponse = await PublicidadeApiService.fetchDisplayCampaigns({
                accessToken: account.token.accessToken,
                advertiserId: advertiser.advertiser_id,
              });

              accountSummary.products.DISPLAY.campaigns += displayResponse.results.length;
              displayResponse.results.forEach((campaign) => {
                displayCampaigns.push({
                  ...campaign,
                  accountId: account.id,
                  accountLabel,
                  advertiserId: advertiser.advertiser_id,
                  advertiserSiteId: advertiser.site_id,
                  advertiserName: advertiser.advertiser_name,
                });
              });
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          accountSummary.products[product] = {
            advertisers: 0,
            campaigns: 0,
            ads: 0,
            available: false,
            error: message,
          };
          errors.push({ accountId: account.id, accountName: accountLabel, product, message });
        }
      }

      try {
        const bonifications = account.token
          ? await PublicidadeApiService.fetchBonifications(account.token.accessToken)
          : [];
        bonificationsByAccount.push({
          accountId: account.id,
          accountLabel,
          bonifications,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push({ accountId: account.id, accountName: accountLabel, product: "BONIFICATIONS", message });
        bonificationsByAccount.push({
          accountId: account.id,
          accountLabel,
          bonifications: [],
        });
      }

      accountSummaries.push(accountSummary);
    }

    const selectedProductCampaign =
      (productCampaignId &&
        productCampaigns.find((campaign) => String(campaign.id) === productCampaignId)) ||
      productCampaigns[0] ||
      null;
    const selectedBrandCampaign =
      (brandCampaignId && brandCampaigns.find((campaign) => String(campaign.campaign_id) === brandCampaignId)) ||
      brandCampaigns[0] ||
      null;
    const selectedDisplayCampaign =
      (displayCampaignId && displayCampaigns.find((campaign) => String(campaign.id) === displayCampaignId)) ||
      displayCampaigns[0] ||
      null;

    let productCampaignDetail: any = null;
    if (selectedProductCampaign) {
      try {
        // Conversões (apenas exemplo)
        let currencyRate = 1; // Se MLB = BRL (1), se MXN = outra (fictício)
        if ((accounts.find(a => a.id === selectedProductCampaign.accountId) as any)?.siteId === "MLB") currencyRate = 1;
        productCampaignDetail = await PublicidadeApiService.fetchProductAdsCampaignDetail({
          accessToken:
            accounts.find((account) => account.id === selectedProductCampaign.accountId)?.token?.accessToken || "",
          advertiserSiteId: selectedProductCampaign.advertiserSiteId,
          campaignId: selectedProductCampaign.id,
          dateFrom,
          dateTo,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push({
          accountId: selectedProductCampaign.accountId,
          accountName: selectedProductCampaign.accountLabel,
          product: "PADS",
          message,
        });
      }
    }

    let brandCampaignDetail: any = null;
    let brandCampaignItems: any[] = [];
    let brandCampaignKeywords: any[] = [];
    let brandKeywordsMetrics: any = null;
    if (selectedBrandCampaign) {
      try {
        const accessToken =
          accounts.find((account) => account.id === selectedBrandCampaign.accountId)?.token?.accessToken || "";
        [
          brandCampaignDetail,
          brandCampaignItems,
          brandCampaignKeywords,
          brandKeywordsMetrics,
        ] = await Promise.all([
          PublicidadeApiService.fetchBrandAdsCampaignDetail({
            accessToken,
            advertiserId: selectedBrandCampaign.advertiserId || 0,
            campaignId: selectedBrandCampaign.campaign_id,
          }),
          PublicidadeApiService.fetchBrandAdsCampaignItems({
            accessToken,
            advertiserId: selectedBrandCampaign.advertiserId || 0,
            campaignId: selectedBrandCampaign.campaign_id,
          }),
          PublicidadeApiService.fetchBrandAdsCampaignKeywords({
            accessToken,
            advertiserId: selectedBrandCampaign.advertiserId || 0,
            campaignId: selectedBrandCampaign.campaign_id,
          }),
          PublicidadeApiService.fetchBrandAdsKeywordsMetrics({
            accessToken,
            advertiserId: selectedBrandCampaign.advertiserId || 0,
            campaignId: selectedBrandCampaign.campaign_id,
            dateFrom,
            dateTo,
          }),
        ]);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push({
          accountId: selectedBrandCampaign.accountId,
          accountName: selectedBrandCampaign.accountLabel,
          product: "BADS",
          message,
        });
      }
    }

    let displayCampaignDetail: any = null;
    let displayLineItems: any[] = [];
    let displayCreativesByLineItem: Record<string, any[]> = {};
    let displayLineItemMetrics: any[] = [];
    if (selectedDisplayCampaign) {
      try {
        const accessToken =
          accounts.find((account) => account.id === selectedDisplayCampaign.accountId)?.token?.accessToken || "";
        const lineItemsResponse = await PublicidadeApiService.fetchDisplayLineItems({
          accessToken,
          advertiserId: selectedDisplayCampaign.advertiserId || 0,
          campaignId: selectedDisplayCampaign.id,
        });

        displayCampaignDetail = await PublicidadeApiService.fetchDisplayCampaignMetrics({
          accessToken,
          advertiserId: selectedDisplayCampaign.advertiserId || 0,
          campaignId: selectedDisplayCampaign.id,
          dateFrom,
          dateTo,
        });

        displayLineItems = lineItemsResponse.results;
        const lineItemsToInspect = lineItemsResponse.results.slice(0, 3);

        const creativeResults = await Promise.all(
          lineItemsToInspect.map(async (lineItem) => {
            const creatives = await PublicidadeApiService.fetchDisplayLineItemCreatives({
              accessToken,
              advertiserId: selectedDisplayCampaign.advertiserId || 0,
              campaignId: selectedDisplayCampaign.id,
              lineItemId: lineItem.line_item_id,
            });
            return { lineItemId: lineItem.line_item_id, creatives: creatives.results };
          })
        );

        creativeResults.forEach(({ lineItemId, creatives }) => {
          displayCreativesByLineItem[String(lineItemId)] = creatives;
        });

        displayLineItemMetrics = await PublicidadeApiService.fetchDisplayMetrics({
          accessToken,
          advertiserId: selectedDisplayCampaign.advertiserId || 0,
          dimension: "line_items",
          dateFrom,
          dateTo,
          campaignId: selectedDisplayCampaign.id,
          ids: lineItemsToInspect.map((lineItem) => lineItem.line_item_id),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push({
          accountId: selectedDisplayCampaign.accountId,
          accountName: selectedDisplayCampaign.accountLabel,
          product: "DISPLAY",
          message,
        });
      }
    }

    const productAdsSummary = {
      advertisers: advertiserIndex.PADS.length,
      campaigns: productCampaigns.length,
      ads: productAds.length,
      recommendedAds: productAds.filter((ad) => Boolean(ad.recommended)).length,
    };

    const brandAdsSummary = {
      advertisers: advertiserIndex.BADS.length,
      campaigns: brandCampaigns.length,
      items: brandCampaignDetail?.items?.length ?? brandCampaignItems.length,
      keywords: brandCampaignDetail?.keywords?.length ?? brandCampaignKeywords.length,
      keywordMetricSets: Array.isArray(brandKeywordsMetrics?.metrics) ? brandKeywordsMetrics.metrics.length : 0,
    };

    const displaySummary = {
      advertisers: advertiserIndex.DISPLAY.length,
      campaigns: displayCampaigns.length,
      lineItems: displayLineItems.length,
      creatives: Object.values(displayCreativesByLineItem).flat().length,
      lineItemMetricSets: Array.isArray(displayLineItemMetrics) ? displayLineItemMetrics.length : 0,
    };

    const activeBonifications = bonificationsByAccount
      .flatMap((entry) => entry.bonifications)
      .filter((item) => item.status === "ACTIVE").length;

    return NextResponse.json({
      success: true,
      dateFrom,
      dateTo,
      accounts: accountSummaries,
      productAds: {
        advertisers: advertiserIndex.PADS.map((entry) => ({
          accountId: entry.accountId,
          accountLabel: entry.accountLabel,
          ...entry.advertiser,
        })),
        campaigns: productCampaigns,
        ads: productAds,
        selectedCampaign: selectedProductCampaign,
        selectedCampaignDetail: productCampaignDetail,
      },
      brandAds: {
        advertisers: advertiserIndex.BADS.map((entry) => ({
          accountId: entry.accountId,
          accountLabel: entry.accountLabel,
          ...entry.advertiser,
        })),
        campaigns: brandCampaigns,
        selectedCampaign: selectedBrandCampaign,
        selectedCampaignDetail: {
          campaign: brandCampaignDetail,
          items: brandCampaignItems,
          keywords: brandCampaignKeywords,
          keywordMetrics: brandKeywordsMetrics,
        },
      },
      display: {
        advertisers: advertiserIndex.DISPLAY.map((entry) => ({
          accountId: entry.accountId,
          accountLabel: entry.accountLabel,
          ...entry.advertiser,
        })),
        campaigns: displayCampaigns,
        selectedCampaign: selectedDisplayCampaign,
        selectedCampaignDetail: {
          metrics: displayCampaignDetail,
          lineItems: displayLineItems,
          creativesByLineItem: displayCreativesByLineItem,
          lineItemMetrics: displayLineItemMetrics,
        },
      },
      bonifications: bonificationsByAccount,
      summary: {
        productAds: productAdsSummary,
        brandAds: brandAdsSummary,
        display: displaySummary,
        bonifications: bonificationsByAccount.flatMap((entry) => entry.bonifications).length,
        activeBonifications,
      },
      errors,
    });
  } catch (error) {
    console.error("GET /api/publicidade/overview error:", error);
    return NextResponse.json({ error: "Erro interno ao carregar publicidade." }, { status: 500 });
  }
}
