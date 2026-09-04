/**
 * Búsqueda de clientes en la bandeja de campaña.
 *
 * El asesor tiene al cliente al teléfono y **un solo dato suelto**: un
 * nombre a medias, el número desde el que llama, un DNI dictado. Obligarle a
 * elegir en qué columna buscar le añade una decisión que no tiene por qué
 * tomar, así que un único término se prueba contra todo.
 *
 * Aquí vive solo la lectura del término. Cómo se consulta cada campo es
 * asunto de la pantalla; qué significa lo que el asesor escribió, no.
 */

export interface RecoverySearchTerm {
  /**
   * Palabras del nombre, en minúsculas. Se exigen **todas**, en cualquier
   * orden: un nombre peruano trae cuatro partes y nadie las dicta enteras ni
   * seguidas — «norma ramos» tiene que encontrar a NORMA ANITA SULLON RAMOS.
   */
  words: string[];
  /**
   * Los dígitos del término, si son suficientes para identificar algo. Sirve
   * igual para DNI, teléfono de contacto y número de línea: el asesor no
   * distingue, y no tiene por qué.
   */
  digits: string | null;
}

/** Menos de esto encuentra media base: no es una búsqueda, es un tropiezo. */
const minimumDigits = 4;
const minimumWordLength = 2;
const maximumWords = 5;
const maximumLength = 80;

export function parseRecoverySearchTerm(
  value: string | null | undefined,
): RecoverySearchTerm | null {
  const text = String(value ?? "")
    .trim()
    .slice(0, maximumLength);

  if (text.length === 0) return null;

  const digits = text.replace(/\D/g, "");
  const words = text
    .toLowerCase()
    .split(/\s+/)
    // Una palabra de un carácter no acota nada. Y lo que no trae ni una
    // letra es un número escrito a su manera —«930-500-638», «+51»—: eso ya
    // lo recogen los dígitos, y como palabra no encontraría ningún nombre.
    .filter((word) => word.length >= minimumWordLength && /\p{L}/u.test(word))
    .slice(0, maximumWords);

  const usableDigits = digits.length >= minimumDigits ? digits : null;

  if (words.length === 0 && usableDigits === null) return null;

  return { words, digits: usableDigits };
}
