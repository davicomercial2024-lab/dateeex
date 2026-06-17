import PocketBase from 'pocketbase';

// O PocketBase permite instanciar globalmente para o client side, mas para Next.js App Router (Server Components e API Routes)
// é recomendável ter instâncias por request, mas como estamos apenas inicializando, podemos exportar um helper
// para uso fácil ou simplesmente instanciar um Singleton para as chamadas de admin do servidor.

export const pbUrl = 'http://crar5r5c8bymozy.pb.cristianbbdi.cloud:7080';

// Retorna uma nova instância do PocketBase
export function getPb() {
  return new PocketBase(pbUrl);
}

// Instância global genérica (apenas para chamadas que não dependem do contexto de request do usuário)
export const pbAdmin = new PocketBase(pbUrl);
