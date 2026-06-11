import Link from "next/link";
import {
  BadgePercent,
  BellRing,
  CircleDollarSign,
  Clock3,
  Layers3,
  ListChecks,
  PackageSearch,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Target,
  Ticket,
  TrendingUp,
  Workflow,
} from "lucide-react";

const monitoringCapabilities = [
  {
    title: "Consultar promoções de um item",
    detail: "Usa /seller-promotions/items/{item_id} para listar todas as promoções associadas a um item e o estado atual de cada oferta.",
    endpoint: "/seller-promotions/items/{ITEM_ID}",
  },
  {
    title: "Consultar itens de uma promoção",
    detail: "Usa /seller-promotions/promotions/{promotion_id}/items para enxergar os itens participantes, com filtros por promotion_type, status e status_item.",
    endpoint: "/seller-promotions/promotions/{PROMOTION_ID}/items",
  },
  {
    title: "Candidatos e ofertas",
    detail: "O recurso de candidates identifica itens convidados; o recurso de offers rastreia mudanças de oferta e status ao longo do ciclo da campanha.",
    endpoint: "/seller-promotions/candidates/{CANDIDATE_ID} e /seller-promotions/offers/{OFFER_ID}",
  },
  {
    title: "Preço vencedor e concorrência",
    detail: "Para precificação competitiva, o ecossistema também expõe sale_price e price_to_win para entender o preço exibido e a posição competitiva do anúncio.",
    endpoint: "/items/{ITEM_ID}/sale_price e /items/{ITEM_ID}/price_to_win",
  },
];

const campaignTypes = [
  "DEAL",
  "MARKETPLACE_CAMPAIGN",
  "PRICE_DISCOUNT",
  "LIGHTNING",
  "DOD",
  "VOLUME",
  "PRE_NEGOTIATED",
  "SELLER_CAMPAIGN",
  "SMART",
  "PRICE_MATCHING",
  "UNHEALTHY_STOCK",
  "SELLER_COUPON_CAMPAIGN",
];

const implementationTracks = [
  {
    title: "Campanhas tradicionais e co-financiadas",
    detail:
      "Permitem indicar, atualizar e remover itens de campanhas com preços de deal e top deal, além de consultar status candidate, pending e started.",
    icon: Workflow,
  },
  {
    title: "Preço individual e descontos programados",
    detail:
      "PRICE_DISCOUNT, DOD e LIGHTNING suportam consulta e remoção; para edição, a documentação indica remover e reaplicar a promoção.",
    icon: BadgePercent,
  },
  {
    title: "Desconto por volume",
    detail:
      "VOLUME permite configurar buy_quantity/pay_quantity_discount_percentage, allow_combination e subtipos como BNGM, BNSP e SPONTH.",
    icon: ListChecks,
  },
  {
    title: "Cupons do vendedor",
    detail:
      "SELLER_COUPON_CAMPAIGN suporta cupom com código ou sem código, itens ativos/pausados e restrição de disponibilidade por país/conta.",
    icon: Ticket,
  },
  {
    title: "Campanhas do vendedor e smart",
    detail:
      "SELLER_CAMPAIGN e SMART permitem indicar, modificar e remover itens em campanhas do vendedor e de co-participação automatizada.",
    icon: Sparkles,
  },
  {
    title: "Liquidação e preço competitivo",
    detail:
      "UNHEALTHY_STOCK e PRICE_MATCHING entram na camada de gestão de preço competitivo e liquidação, úteis para reprecificação automática.",
    icon: Target,
  },
];

const notes = [
  "Algumas campanhas aceitam apenas itens de certas lojas ou países, como SELLER_COUPON_CAMPAIGN que hoje é documentada para MLB.",
  "O filtro status_item aceita active e paused e ajuda a separar participação ativa de itens pausados.",
  "A API também expõe notificações para items_prices, candidate e offers, o que viabiliza sincronização incremental.",
  "A documentação avisa que o front pode mostrar estados ligeiramente diferentes da API em alguns momentos assíncronos.",
];

export default function PromocoesPage() {
  return (
    <div className="space-y-10 pb-10">
      <section className="overflow-hidden rounded-[2rem] border border-border/60 bg-card/70 shadow-xl shadow-background/30 backdrop-blur-sm">
        <div className="grid gap-8 p-6 md:grid-cols-[1.2fr_0.8fr] md:p-8">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.25em] text-primary">
              <BadgePercent className="h-3.5 w-3.5" />
              Promoções
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl font-black tracking-tight text-foreground md:text-5xl">
                Centro de promoções do Mercado Livre
              </h1>
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
                Esta área reúne tudo que pode ser construído a partir da API oficial de
                seller-promotions: monitoramento de itens, campanhas, candidatos, ofertas,
                precificação competitiva e automações por tipo de campanha.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link href="#itens" className="rounded-full border border-border/60 bg-background/60 px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-accent/70">
                Ver funcionalidades
              </Link>
              <Link href="#tipos" className="rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/15">
                Tipos suportados
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
            <div className="rounded-2xl border border-border/50 bg-background/70 p-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                <ShoppingBag className="h-4 w-4 text-primary" />
                Cobertura da API
              </div>
              <p className="mt-3 text-sm text-foreground">
                Itens, promoções, candidatos, ofertas, preço vencedor e sincronização de estado.
              </p>
            </div>
            <div className="rounded-2xl border border-border/50 bg-background/70 p-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Regras
              </div>
              <p className="mt-3 text-sm text-foreground">
                Alguns tipos exigem reaplicação para edição e alguns recursos são restritos por país/canal.
              </p>
            </div>
            <div className="rounded-2xl border border-border/50 bg-background/70 p-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                <Clock3 className="h-4 w-4 text-primary" />
                Atualização
              </div>
              <p className="mt-3 text-sm text-foreground">
                A documentação oficial consultada está atualizada até 2026 e descreve estados assíncronos como candidate e started.
              </p>
            </div>
            <div className="rounded-2xl border border-border/50 bg-background/70 p-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                <CircleDollarSign className="h-4 w-4 text-primary" />
                Precificação
              </div>
              <p className="mt-3 text-sm text-foreground">
                sale_price e price_to_win complementam a camada de promoções para decisões de preço e competitividade.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="itens" className="space-y-4">
        <div className="flex items-center gap-3">
          <PackageSearch className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-xl font-black text-foreground">Monitoramento e leitura</h2>
            <p className="text-sm text-muted-foreground">
              Funcionalidades de consulta e observabilidade que a API permite implementar.
            </p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {monitoringCapabilities.map((item) => (
            <article key={item.title} className="rounded-2xl border border-border/60 bg-card/60 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-bold text-foreground">{item.title}</h3>
                <span className="rounded-full border border-border/60 bg-secondary/40 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  API
                </span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.detail}</p>
              <p className="mt-4 rounded-xl border border-border/50 bg-secondary/20 px-3 py-2 text-[11px] font-mono text-foreground/90">
                {item.endpoint}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section id="tipos" className="space-y-4">
        <div className="flex items-center gap-3">
          <Layers3 className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-xl font-black text-foreground">Tipos de promoção suportados</h2>
            <p className="text-sm text-muted-foreground">
              Lista consolidada dos tipos documentados que podem ser tratados na integração.
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {campaignTypes.map((type) => (
            <div key={type} className="rounded-2xl border border-border/60 bg-card/55 px-4 py-4">
              <span className="text-sm font-bold text-foreground">{type}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="eventos" className="space-y-4">
        <div className="flex items-center gap-3">
          <BellRing className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-xl font-black text-foreground">Eventos e automação</h2>
            <p className="text-sm text-muted-foreground">
              A API permite reagir a mudanças de candidate, offer e preços para manter a UI sincronizada.
            </p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {implementationTracks.slice(0, 3).map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title} className="rounded-2xl border border-border/60 bg-card/60 p-5">
                <Icon className="h-5 w-5 text-primary" />
                <h3 className="mt-3 text-sm font-bold text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.detail}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section id="cupom-volume" className="space-y-4">
        <div className="flex items-center gap-3">
          <Ticket className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-xl font-black text-foreground">Campanhas e operações por tipo</h2>
            <p className="text-sm text-muted-foreground">
              É aqui que entram criação, edição, remoção e regras específicas de cada modalidade.
            </p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {implementationTracks.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title} className="rounded-2xl border border-border/60 bg-card/60 p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl border border-primary/15 bg-primary/10 p-2">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold text-foreground">{item.title}</h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">{item.detail}</p>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section id="precificacao" className="space-y-4">
        <div className="flex items-center gap-3">
          <TrendingUp className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-xl font-black text-foreground">Precificação e competitividade</h2>
            <p className="text-sm text-muted-foreground">
              Além das promoções em si, a API de preços ajuda a entender o valor exibido ao comprador.
            </p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <article className="rounded-2xl border border-border/60 bg-card/60 p-5">
            <h3 className="text-sm font-bold text-foreground">sale_price</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Retorna o preço de venda efetivo, incluindo o contexto de canal e nível do comprador.
            </p>
          </article>
          <article className="rounded-2xl border border-border/60 bg-card/60 p-5">
            <h3 className="text-sm font-bold text-foreground">price_to_win</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Mostra a posição competitiva do item no catálogo e permite automatizar ajustes de preço.
            </p>
          </article>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-xl font-black text-foreground">Observações de implementação</h2>
            <p className="text-sm text-muted-foreground">
              Pontos que valem ser respeitados quando formos ligar a UI à API.
            </p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {notes.map((note) => (
            <div key={note} className="rounded-2xl border border-border/60 bg-card/55 p-4 text-sm leading-relaxed text-muted-foreground">
              {note}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
