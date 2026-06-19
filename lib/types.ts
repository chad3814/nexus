export type Significance = "major" | "supporting" | "minor" | "mentioned";
export type EntityType = "person" | "creature" | "faction" | "ai_system" | "place" | "other";
export type EntityTag = "in_world" | "real_world_ref" | "media_ref" | "item_object";
export interface Appearance { anchor: string; snippet: string; }
export interface RegistryEntity {
  id: string;
  canonicalName: string;
  aliases: string[];
  type: EntityType;
  tags: EntityTag[];
  significance: Significance;
  description: string;
  firstAppearance: Appearance | null;
  appearances: string[];
}
export interface BookSections { number: number; sections: string[]; }
export interface Registry { booksProcessed: number[]; entities: RegistryEntity[]; books?: BookSections[]; }
export interface DescriptionEvent { id: string; anchor: string; description: string; significance: Significance; }
export interface AliasEvent { id: string; anchor: string; alias: string; }
export type Cutoff = string;
export interface SeriesManifest {
  id: string;
  title: string;
  author: string;
  books: Array<{ number: number; chapters: string[] }>;
}
