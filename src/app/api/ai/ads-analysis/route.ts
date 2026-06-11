import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import OpenAI from "openai";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("datex_session")?.value;
    if (!token) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const session = await verifyToken(token);
    if (!session) return NextResponse.json({ error: "Sessão inválida" }, { status: 401 });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Chave da API da OpenAI (OPENAI_API_KEY) não configurada no ambiente." }, { status: 500 });
    }

    const openai = new OpenAI({ apiKey });
    const { campaigns, summary } = await request.json();

    if (!campaigns || campaigns.length === 0) {
      return NextResponse.json({ error: "Nenhuma campanha fornecida para análise." }, { status: 400 });
    }

    const prompt = `
    Atue como um Especialista de Performance de Ads do Mercado Livre para a plataforma Datex.
    Aqui está o resumo geral das métricas do vendedor nos últimos 30 dias:
    - ROAS Global: ${summary.roas?.toFixed(2)}x
    - ACOS Global: ${summary.acos?.toFixed(2)}%
    - Investimento Total: R$ ${summary.cost?.toFixed(2)}
    - Receita com Ads: R$ ${summary.salesAmountAds?.toFixed(2)}
    
    Aqui estão os dados individuais das campanhas ativas e pausadas:
    ${JSON.stringify(campaigns.map((c: any) => ({
      name: c.name,
      status: c.status,
      budget: c.budget,
      clicks: c.metrics.clicks,
      cost: c.metrics.cost,
      sales: c.metrics.sales,
      acos: c.metrics.acos
    })), null, 2)}

    Com base nesses dados reais, forneça uma análise técnica concisa. O retorno OBRIGATORIAMENTE DEVE SER UM JSON válido, seguindo estritamente este formato:
    {
      "globalDiagnostic": "Resumo geral da performance em 1 parágrafo curto.",
      "criticalIssues": ["lista de problemas como ACOS alto, orçamento esgotando sem vendas"],
      "actionableSteps": [
        {
          "campaignName": "Nome exato da campanha",
          "action": "Qual ação deve ser tomada no painel",
          "reason": "Por que (ex: ACOS de 30% está fora da margem)"
        }
      ]
    }
    Não inclua markdown \`\`\`json em torno da resposta, apenas o objeto JSON puro.
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0]?.message?.content || "{}";
    const analysis = JSON.parse(content);

    return NextResponse.json({ success: true, analysis });
  } catch (error: any) {
    console.error("Erro na integração com OpenAI:", error);
    return NextResponse.json({ error: error.message || "Falha ao analisar com IA." }, { status: 500 });
  }
}
