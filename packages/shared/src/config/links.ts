export const LINK_GROUPS = ["tracking", "documents", "citizenship"] as const;
export type LinkGroup = (typeof LINK_GROUPS)[number];

export interface UsefulLink {
  /** Stable id; i18n keys are `links.item.<id>.title`. */
  id: string;
  group: LinkGroup;
  url: string;
}

/** External resources shown on the "Useful links" page (order = display order). */
export const USEFUL_LINKS = [
  { id: "dni-approval", group: "tracking", url: "https://www.migraciones.gob.ar/accesible/consultaTramitePrecaria/ConsultaUnificada.php" },
  { id: "dni-production", group: "tracking", url: "https://mitramite.renaper.gob.ar/" },
  { id: "dni-post", group: "tracking", url: "https://www.correoargentino.com.ar/formularios/ondng" },
  { id: "citizenship-status", group: "tracking", url: "https://www.migraciones.gob.ar/accesible/consultaTramiteCiudadania/ConsultaCiudadania.php" },
  { id: "court-status", group: "tracking", url: "https://scw.pjn.gov.ar/scw/home.seam" },
  { id: "entry-certificate", group: "documents", url: "https://www.migraciones.gob.ar/transitos/" },
  { id: "criminal-record-turn", group: "documents", url: "https://www.argentina.gob.ar/servicio/solicitar-certificado-de-antecedentes-penales-personalmente" },
  { id: "citizenship-procedure", group: "citizenship", url: "https://www.argentina.gob.ar/noticias/ahora-el-tramite-de-ciudadania-argentina-se-podra-hacer-de-forma-digital-en-migraciones" },
  { id: "citizenship-documents", group: "citizenship", url: "https://radex.dnm.gov.ar/pretramite_ciudadania/index.php" },
] as const satisfies readonly UsefulLink[];

export type UsefulLinkId = (typeof USEFUL_LINKS)[number]["id"];

export function findLink(id: string): UsefulLink | undefined {
  return USEFUL_LINKS.find((link) => link.id === id);
}
