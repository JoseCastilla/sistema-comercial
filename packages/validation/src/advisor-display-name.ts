function normalizeNamePart(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function titleCase(value: string): string {
  const normalized = value.trim().toLocaleLowerCase("es-PE");

  return normalized
    ? `${normalized.charAt(0).toLocaleUpperCase("es-PE")}${normalized.slice(1)}`
    : "";
}

/**
 * Presenta la identidad corporativa como “Primer nombre + inicial del primer
 * apellido”. El correo corporativo define los dos segmentos y el nombre
 * registrado conserva tildes y grafía cuando existe una coincidencia.
 */
export function formatAdvisorCompactName(name: string, email: string): string {
  const nameTokens = name.trim().split(/\s+/).filter(Boolean);
  const localParts = email
    .split("@", 1)[0]
    ?.split(".")
    .map(normalizeNamePart)
    .filter(Boolean);
  const firstNameKey = localParts?.[0] ?? "";
  const surnameKey = localParts?.[1] ?? "";
  const normalizedTokens = nameTokens.map(normalizeNamePart);
  const firstNameIndex = normalizedTokens.findIndex(
    (token) => token === firstNameKey,
  );
  const resolvedFirstNameIndex = firstNameIndex >= 0 ? firstNameIndex : 0;
  const firstName = titleCase(
    nameTokens[resolvedFirstNameIndex] ?? firstNameKey,
  );

  let surnameInitial = "";
  if (surnameKey) {
    for (
      let start = resolvedFirstNameIndex + 1;
      start < nameTokens.length;
      start += 1
    ) {
      let combined = "";

      for (let end = start; end < nameTokens.length; end += 1) {
        combined += normalizedTokens[end];
        if (normalizedTokens[end] === surnameKey) {
          surnameInitial = nameTokens[end]?.charAt(0) ?? "";
          break;
        }
        if (combined === surnameKey) {
          surnameInitial = nameTokens[start]?.charAt(0) ?? "";
          break;
        }
        if (combined.length > surnameKey.length) break;
      }

      if (surnameInitial) break;
    }

    surnameInitial ||= surnameKey.charAt(0);
  } else {
    surnameInitial = nameTokens[resolvedFirstNameIndex + 1]?.charAt(0) ?? "";
  }

  const initial = surnameInitial.toLocaleUpperCase("es-PE");

  return [firstName, initial ? `${initial}.` : ""].filter(Boolean).join(" ");
}

/**
 * Presenta la identidad como “Primer nombre + primer apellido” con inicial
 * mayúscula (SPEC-038 BR-017). El correo corporativo resuelve qué segmentos
 * del nombre registrado son el nombre y el apellido, de modo que un apellido
 * compuesto como “DE LOS RIOS” se reconstruye entero.
 *
 * Es solo presentación: el nombre registrado no se altera porque es la
 * identidad legal que necesitará la liquidación (BR-018).
 */
export function formatAdvisorDisplayName(name: string, email: string): string {
  const nameTokens = name.trim().split(/\s+/).filter(Boolean);
  if (nameTokens.length === 0) return "";

  const localParts = email
    .split("@", 1)[0]
    ?.split(".")
    .map(normalizeNamePart)
    .filter(Boolean);
  const firstNameKey = localParts?.[0] ?? "";
  const surnameKey = localParts?.[1] ?? "";
  const normalizedTokens = nameTokens.map(normalizeNamePart);

  const firstNameIndex = normalizedTokens.findIndex(
    (token) => token === firstNameKey,
  );
  const resolvedFirstNameIndex = firstNameIndex >= 0 ? firstNameIndex : 0;
  const firstName = titleCase(
    nameTokens[resolvedFirstNameIndex] ?? firstNameKey,
  );

  let surname = "";
  if (surnameKey) {
    // El apellido del correo puede corresponder a uno o varios tokens
    // seguidos del nombre registrado.
    for (
      let start = resolvedFirstNameIndex + 1;
      start < nameTokens.length && !surname;
      start += 1
    ) {
      let combined = "";

      for (let end = start; end < nameTokens.length; end += 1) {
        combined += normalizedTokens[end];

        if (combined === surnameKey) {
          surname = nameTokens
            .slice(start, end + 1)
            .map(titleCase)
            .join(" ");
          break;
        }

        if (combined.length > surnameKey.length) break;
      }
    }
  }

  // Sin correo aprovechable, el siguiente token es el mejor candidato.
  surname ||= titleCase(nameTokens[resolvedFirstNameIndex + 1] ?? "");

  return [firstName, surname].filter(Boolean).join(" ");
}
