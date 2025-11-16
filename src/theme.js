import chalkModule, { Chalk } from 'chalk';

const base = {
  heading: { color: 'yellow', bold: true },
  strong: { bold: true },
  emph: { italic: true },
  inlineCode: { color: 'cyan', dim: true },
  blockCode: { color: 'cyan', dim: true },
  link: { color: 'blue', underline: true },
  quote: { dim: true },
  hr: { dim: true },
  listMarker: { color: 'cyan' },
  tableHeader: { bold: true },
  tableCell: {},
};

const dim = {
  ...base,
  heading: { color: 'white', bold: true, dim: true },
  link: { color: 'blue', underline: true, dim: true },
};

const bright = {
  ...base,
  heading: { color: 'magenta', bold: true },
  link: { color: 'cyan', underline: true },
  inlineCode: { color: 'green' },
  blockCode: { color: 'green' },
};

export const themes = {
  default: base,
  dim,
  bright,
};

export function createStyler({ color }) {
  const level = color ? 3 : 0;
  const chalk = new Chalk({ level });
  const apply = (text, style = {}) => {
    if (!color) return text;
    let fn = chalk;
    if (style.color && fn[style.color]) fn = fn[style.color];
    if (style.bgColor && fn[style.bgColor]) fn = fn[style.bgColor];
    if (style.bold) fn = fn.bold;
    if (style.italic) fn = fn.italic;
    if (style.underline) fn = fn.underline;
    if (style.dim) fn = fn.dim;
    if (style.strike) fn = fn.strikethrough;
    return fn(text);
  };
  return apply;
}
