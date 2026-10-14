/**
 * Jurisdictions of the PJN public consultation (scw.pjn.gov.ar). `value` is the
 * option value of the site's select and is what the scraper sends.
 */
export interface PjnJurisdiction {
  value: string;
  code: string;
  name: string;
}

const RAW: readonly [string, string, string][] = [
  ["0", "CSJ", "Corte Suprema de Justicia de la Nación"],
  ["1", "CIV", "Cámara Nacional de Apelaciones en lo Civil"],
  ["2", "CAF", "Cámara Nacional de Apelaciones en lo Contencioso Administrativo Federal"],
  ["3", "CCF", "Cámara Nacional de Apelaciones en lo Civil y Comercial Federal"],
  ["4", "CNE", "Cámara Nacional Electoral"],
  ["5", "CSS", "Cámara Federal de la Seguridad Social"],
  ["6", "CPE", "Cámara Nacional de Apelaciones en lo Penal Económico"],
  ["7", "CNT", "Cámara Nacional de Apelaciones del Trabajo"],
  ["8", "CFP", "Cámara Criminal y Correccional Federal"],
  ["9", "CCC", "Cámara Nacional de Apelaciones en lo Criminal y Correccional"],
  ["10", "COM", "Cámara Nacional de Apelaciones en lo Comercial"],
  ["11", "CPF", "Cámara Federal de Casación Penal"],
  ["12", "CPN", "Cámara Nacional Casación Penal"],
  ["13", "FBB", "Justicia Federal de Bahía Blanca"],
  ["14", "FCR", "Justicia Federal de Comodoro Rivadavia"],
  ["15", "FCB", "Justicia Federal de Córdoba"],
  ["16", "FCT", "Justicia Federal de Corrientes"],
  ["17", "FGR", "Justicia Federal de General Roca"],
  ["18", "FLP", "Justicia Federal de La Plata"],
  ["19", "FMP", "Justicia Federal de Mar del Plata"],
  ["20", "FMZ", "Justicia Federal de Mendoza"],
  ["21", "FPO", "Justicia Federal de Posadas"],
  ["22", "FPA", "Justicia Federal de Paraná"],
  ["23", "FRE", "Justicia Federal de Resistencia"],
  ["24", "FSA", "Justicia Federal de Salta"],
  ["25", "FRO", "Justicia Federal de Rosario"],
  ["26", "FSM", "Justicia Federal de San Martín"],
  ["27", "FTU", "Justicia Federal de Tucumán"],
];

export const PJN_JURISDICTIONS: readonly PjnJurisdiction[] = RAW.map(([value, code, name]) => ({
  value,
  code,
  name,
}));

/** Court of citizenship cases; preselected in the court dropdown. */
export const PJN_DEFAULT_JURISDICTION = "4";

export function findJurisdiction(value: string | null | undefined): PjnJurisdiction | undefined {
  return PJN_JURISDICTIONS.find((item) => item.value === value);
}
