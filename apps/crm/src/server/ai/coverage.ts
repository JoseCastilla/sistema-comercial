/**
 * Zona de reparto conocida (SPEC-058 BR-007, herramienta «consultar cobertura»).
 *
 * El esquema del MVP no tiene tabla de zonas de reparto, así que aquí vive una
 * lista fija de distritos de Lima y Callao donde el negocio sí entrega. La
 * respuesta siempre aclara que la dirección exacta la confirma un asesor: esto
 * responde «¿llegan a mi distrito?», no «¿llegan a mi calle?». Módulo puro.
 */

/** Distritos con reparto. Al haber tabla de zonas, esta constante se reemplaza por la consulta. */
export const DELIVERY_DISTRICTS = [
  // Lima
  "Ancón", "Ate", "Barranco", "Breña", "Carabayllo", "Chaclacayo", "Chorrillos", "Cieneguilla",
  "Comas", "El Agustino", "Independencia", "Jesús María", "La Molina", "La Victoria", "Lima",
  "Lince", "Los Olivos", "Lurigancho", "Lurín", "Magdalena del Mar", "Miraflores", "Pachacámac",
  "Pucusana", "Pueblo Libre", "Puente Piedra", "Punta Hermosa", "Punta Negra", "Rímac",
  "San Bartolo", "San Borja", "San Isidro", "San Juan de Lurigancho", "San Juan de Miraflores",
  "San Luis", "San Martín de Porres", "San Miguel", "Santa Anita", "Santa María del Mar",
  "Santa Rosa", "Santiago de Surco", "Surquillo", "Villa El Salvador", "Villa María del Triunfo",
  // Callao
  "Bellavista", "Callao", "Carmen de la Legua Reynoso", "La Perla", "La Punta", "Mi Perú", "Ventanilla",
] as const;

/** Sin tildes, sin dobles espacios y en minúsculas: «SJL» no, pero «san isidro» sí. */
export function normalizeDistrict(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const NORMALIZED = new Map(DELIVERY_DISTRICTS.map((district) => [normalizeDistrict(district), district]));

export interface CoverageAnswer {
  /** Distrito reconocido en la lista, con su nombre correcto. */
  district: string | null;
  covered: boolean;
}

/** Busca el distrito en la lista. Sin coincidencia devuelve `covered: false` y `district: null`. */
export function districtCoverage(value: string): CoverageAnswer {
  const key = normalizeDistrict(value);
  if (!key) return { district: null, covered: false };
  const exact = NORMALIZED.get(key);
  if (exact) return { district: exact, covered: true };
  // «surco» por «Santiago de Surco», «villa el salvador» escrito de más.
  for (const [normalized, district] of NORMALIZED) {
    if (normalized.includes(key) && key.length >= 4) return { district, covered: true };
  }
  return { district: null, covered: false };
}
