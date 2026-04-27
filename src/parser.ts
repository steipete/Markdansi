import type { Root } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import { gfmFromMarkdown } from "mdast-util-gfm";
import { gfm as gfmSyntax } from "micromark-extension-gfm";

export function parse(markdown: string): Root {
  return fromMarkdown(markdown, {
    extensions: [gfmSyntax()],
    mdastExtensions: [gfmFromMarkdown()],
  });
}
