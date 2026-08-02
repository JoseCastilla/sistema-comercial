/**
 * Puerto mínimo que la API necesita del cliente Prisma.
 */
export interface DatabaseClientPort {
  $connect(): Promise<void>;

  $disconnect(): Promise<void>;

  $queryRawUnsafe(query: string, ...values: unknown[]): Promise<unknown>;
}
