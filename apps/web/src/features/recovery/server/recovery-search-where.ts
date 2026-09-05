import "server-only";

import { allOf, parseRecoverySearchTerm } from "@repo/validation";

import type { Prisma } from "@repo/database";

/**
 * Condición de búsqueda de un cliente por un dato suelto (BR-088), para las
 * colas administrativas: nombre, DNI, teléfono de contacto o número de
 * línea, con un solo término.
 *
 * Las palabras del nombre se exigen todas, en cualquier orden; los dígitos
 * valen para los tres campos numéricos porque quien tiene el dato en la mano
 * no sabe cuál de ellos es. Devuelve `null` cuando no hay nada buscable, para
 * que el llamador lo pase a `allOf` sin condicionales.
 */
export function buildRecoverySearchWhere(
  term: string,
): Prisma.RecoveryCaseWhereInput | null {
  const search = parseRecoverySearchTerm(term);

  if (!search) return null;

  return allOf<Prisma.RecoveryCaseWhereInput>(
    ...search.words.map((word) => ({
      holderName: { contains: word, mode: "insensitive" as const },
    })),
    search.digits
      ? {
          OR: [
            { documentNumber: { contains: search.digits } },
            { phones: { some: { phoneNumber: { contains: search.digits } } } },
            {
              services: {
                some: {
                  discardedAt: null,
                  serviceNumber: { contains: search.digits },
                },
              },
            },
          ],
        }
      : null,
  );
}
