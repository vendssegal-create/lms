import { XMLParser } from 'fast-xml-parser';

export const NS = {
  w: 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
  r: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  wp: 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
  a: 'http://schemas.openxmlformats.org/drawingml/2006/main',
  pic: 'http://schemas.openxmlformats.org/drawingml/2006/picture',
  rel: 'http://schemas.openxmlformats.org/package/2006/relationships',
} as const;

const parserOptions = {
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  preserveOrder: true,
  trimValues: false,
  parseTagValue: false,
  parseAttributeValue: false,
  processEntities: true,
  cdataPropName: '__cdata',
};

let _parser: XMLParser | null = null;

export function getXmlParser(): XMLParser {
  if (!_parser) {
    _parser = new XMLParser(parserOptions);
  }
  return _parser;
}

export function parseXml(xml: string): any[] {
  return getXmlParser().parse(xml);
}

/** Find first child element by local tag name in preserveOrder parsed array */
export function findEl(nodes: any[], tagName: string): any | undefined {
  if (!Array.isArray(nodes)) return undefined;
  for (const node of nodes) {
    if (node[tagName] !== undefined) return node;
  }
  return undefined;
}

/** Find all child elements by local tag name */
export function findAllEl(nodes: any[], tagName: string): any[] {
  if (!Array.isArray(nodes)) return [];
  return nodes.filter((n) => n[tagName] !== undefined);
}

/** Get attributes object from a preserveOrder node */
export function getAttrs(node: any): Record<string, string> {
  return node?.[':@'] ?? {};
}

/** Get text content from <w:t> or similar text-only element */
export function getTextContent(nodes: any[]): string {
  if (!Array.isArray(nodes)) return '';
  let text = '';
  for (const n of nodes) {
    if (typeof n === 'string') {
      text += n;
    } else if (n['#text'] !== undefined) {
      text += String(n['#text']);
    } else {
      const keys = Object.keys(n).filter((k) => k !== ':@');
      for (const k of keys) {
        if (Array.isArray(n[k])) {
          text += getTextContent(n[k]);
        }
      }
    }
  }
  return text;
}

/** Get attribute value by full prefixed name */
export function attr(node: any, name: string): string | undefined {
  const attrs = getAttrs(node);
  return attrs[`@_${name}`] ?? attrs[name];
}
