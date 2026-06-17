import PocketBase from 'pocketbase';

export const pbUrl = process.env.NEXT_PUBLIC_POCKETBASE_URL as string;

// Retorna uma nova instância do PocketBase
export function getPb() {
  const pb = new PocketBase(pbUrl);
  pb.autoCancellation(false);
  return pb;
}

// Instância global genérica (apenas para chamadas que não dependem do contexto de request do usuário)
export const pbAdmin = new PocketBase(pbUrl);
pbAdmin.autoCancellation(false);
