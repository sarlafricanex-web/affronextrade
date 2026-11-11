// Types de documents d'entreprise (contrainte company_documents.kind), partages navigateur et serveur.
export const DOCUMENT_KINDS = ["registration", "iso", "halal", "phytosanitary", "certification", "other"] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];
export const MAX_DOCUMENTS = 20;
export const DOCUMENT_MAX_BYTES = 4 * 1024 * 1024; // limite des envois Vercel (4,5 Mo)
