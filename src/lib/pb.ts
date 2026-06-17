import PocketBase from 'pocketbase';

export const pbUrl = process.env.NEXT_PUBLIC_POCKETBASE_URL as string;

// Retorna uma nova instância do PocketBase
export function getPb() {
  return new PocketBase(pbUrl);
}

// Instância global genérica (apenas para chamadas que não dependem do contexto de request do usuário)
export const pbAdmin = new PocketBase(pbUrl);
