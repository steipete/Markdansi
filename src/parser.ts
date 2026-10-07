import { decodeNamedCharacterReference } from "decode-named-character-reference";
import { marked, type Token, type Tokens } from "marked";
import type { BlockNode, Code, InlineNode, ListItem, Root, TableCell, TableRow } from "./ast.js";

const CHARACTER_REFERENCE = /&(#\d+|#x[\da-f]+|[a-z][\da-z]+);/giu;

function decodeNumericReference(body: string, radix: 10 | 16): string {
  const offset = radix === 16 ? 2 : 1;
  const codePoint = Number.parseInt(body.slice(offset), radix);
  const isDisallowedControl =
    codePoint <= 0x08 ||
    codePoint === 0x0b ||
    (codePoint >= 0x0e && codePoint <= 0x1f) ||
    (codePoint >= 0x7f && codePoint <= 0x9f);
  const isNonCharacter =
    (codePoint >= 0xfdd0 && codePoint <= 0xfdef) ||
    (codePoint & 0xffff) === 0xfffe ||
    (codePoint & 0xffff) === 0xffff;
  if (
    !Number.isSafeInteger(codePoint) ||
    codePoint <= 0 ||
    codePoint > 0x10ffff ||
    (codePoint >= 0xd800 && codePoint <= 0xdfff) ||
    isDisallowedControl ||
    isNonCharacter
  ) {
    return "\uFFFD";
  }
  return String.fromCodePoint(codePoint);
}

function decodeEntities(value: string): string {
  return value.replace(CHARACTER_REFERENCE, (reference, body: string) => {
    if (body.startsWith("#x") || body.startsWith("#X")) {
      return decodeNumericReference(body, 16);
    }
    if (body.startsWith("#")) {
      return decodeNumericReference(body, 10);
    }
    return decodeNamedCharacterReference(body) || reference;
  });
}

function convertInlineTokens(tokens: Token[] | undefined): InlineNode[] {
  if (!tokens) return [];
  const nodes: InlineNode[] = [];
  for (const token of tokens) {
    switch (token.type) {
      case "text": {
        const text = token as Tokens.Text;
        if (text.tokens?.length) {
          nodes.push(...convertInlineTokens(text.tokens));
        } else {
          // Marked decodes numeric references in text; raw keeps validation and decoding single-pass.
          nodes.push({ type: "text", value: decodeEntities(text.raw) });
        }
        break;
      }
      case "escape":
        nodes.push({ type: "text", value: (token as Tokens.Escape).text });
        break;
      case "em":
        nodes.push({
          type: "emphasis",
          children: convertInlineTokens((token as Tokens.Em).tokens),
        });
        break;
      case "strong":
        nodes.push({
          type: "strong",
          children: convertInlineTokens((token as Tokens.Strong).tokens),
        });
        break;
      case "del":
        nodes.push({
          type: "delete",
          children: convertInlineTokens((token as Tokens.Del).tokens),
        });
        break;
      case "codespan":
        nodes.push({ type: "inlineCode", value: (token as Tokens.Codespan).text });
        break;
      case "link": {
        const link = token as Tokens.Link;
        nodes.push({
          type: "link",
          url: decodeEntities(link.href),
          title: link.title ? decodeEntities(link.title) : link.title,
          children: convertInlineTokens(link.tokens),
        });
        break;
      }
      case "br":
        nodes.push({ type: "break" });
        break;
      case "html":
        nodes.push({ type: "html", value: (token as Tokens.HTML).text });
        break;
      default:
        break;
    }
  }
  return nodes;
}

function convertCode(token: Tokens.Code): Code {
  const info = token.lang?.trim() ?? "";
  const separator = info.search(/\s/u);
  const lang = separator >= 0 ? info.slice(0, separator) : info;
  const meta = separator >= 0 ? info.slice(separator).trim() : "";
  return {
    type: "code",
    value: token.text,
    ...(lang ? { lang } : {}),
    ...(meta ? { meta } : {}),
  };
}

function convertListItem(item: Tokens.ListItem): ListItem {
  return {
    type: "listItem",
    checked: item.task ? Boolean(item.checked) : null,
    spread: item.loose,
    children: convertBlockTokens(item.tokens),
  };
}

function convertTableCell(cell: Tokens.TableCell): TableCell {
  return {
    type: "tableCell",
    children: convertInlineTokens(cell.tokens),
  };
}

function convertTableRow(cells: Tokens.TableCell[]): TableRow {
  return {
    type: "tableRow",
    children: cells.map(convertTableCell),
  };
}

function convertBlockToken(token: Token): BlockNode | null {
  switch (token.type) {
    case "paragraph":
      return {
        type: "paragraph",
        children: convertInlineTokens((token as Tokens.Paragraph).tokens),
      };
    case "text": {
      const text = token as Tokens.Text;
      return {
        type: "paragraph",
        children: text.tokens?.length
          ? convertInlineTokens(text.tokens)
          : [{ type: "text", value: decodeEntities(text.text) }],
      };
    }
    case "heading": {
      const heading = token as Tokens.Heading;
      return {
        type: "heading",
        depth: heading.depth,
        children: convertInlineTokens(heading.tokens),
      };
    }
    case "hr":
      return { type: "thematicBreak" };
    case "blockquote":
      return {
        type: "blockquote",
        children: convertBlockTokens((token as Tokens.Blockquote).tokens),
      };
    case "list": {
      const list = token as Tokens.List;
      return {
        type: "list",
        ordered: list.ordered,
        start: list.ordered && typeof list.start === "number" ? list.start : null,
        spread: list.loose,
        children: list.items.map(convertListItem),
      };
    }
    case "code":
      return convertCode(token as Tokens.Code);
    case "table": {
      const table = token as Tokens.Table;
      return {
        type: "table",
        align: table.align,
        children: [convertTableRow(table.header), ...table.rows.map(convertTableRow)],
      };
    }
    case "def": {
      const definition = token as Tokens.Def;
      const title = decodeEntities((definition.title ?? "").replace(/\s+/gu, " ").trim());
      return {
        type: "definition",
        identifier: definition.tag,
        url: decodeEntities(definition.href),
        title: title || null,
      };
    }
    default:
      return null;
  }
}

function convertBlockTokens(tokens: Token[]): BlockNode[] {
  return tokens.flatMap((token) => {
    const node = convertBlockToken(token);
    return node ? [node] : [];
  });
}

export function parse(markdown: string): Root {
  return {
    type: "root",
    children: convertBlockTokens(marked.lexer(markdown, { gfm: true })),
  };
}
