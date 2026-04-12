import { parseXml, findAllEl, attr } from './xml-helpers';
import type { Relationship, RelationshipMap } from '../types';

export function parseRelationships(xml: string): RelationshipMap {
  const map: RelationshipMap = {};
  try {
    const parsed = parseXml(xml);
    const relsNode = parsed.find(
      (n: any) => n['Relationships'] !== undefined
    );
    if (!relsNode) return map;

    const rels = findAllEl(relsNode['Relationships'], 'Relationship');
    for (const rel of rels) {
      const id = attr(rel, 'Id') ?? '';
      const type = attr(rel, 'Type') ?? '';
      const target = attr(rel, 'Target') ?? '';
      if (id) {
        map[id] = { id, type, target };
      }
    }
  } catch {
    // gracefully return empty map for malformed rels
  }
  return map;
}

export function getImageRelTargets(rels: RelationshipMap): Record<string, string> {
  const imageRels: Record<string, string> = {};
  for (const [id, rel] of Object.entries(rels)) {
    if (
      rel.type.includes('/image') ||
      rel.target.match(/\.(png|jpe?g|gif|bmp|tiff?|svg|webp|emf|wmf)$/i)
    ) {
      imageRels[id] = rel.target;
    }
  }
  return imageRels;
}
