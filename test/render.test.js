import { describe, it, expect } from 'vitest';
import { render, strip } from '../src/index.js';
import { themes } from '../src/theme.js';

const noColor = { color: false, hyperlinks: false, wrap: true, width: 40 };

describe('inline formatting', () => {
  it('renders emphasis/strong/code/strike', () => {
    const out = strip('Hello _em_ **strong** `code` ~~gone~~', noColor);
    expect(out).toContain('Hello em strong code gone');
  });

  it('uses blockCode / inlineCode themes distinctly', () => {
    const ansi = render('`inline`\n\n```\nblock\n```', {
      color: true,
      theme: {
        ...themes.default,
        inlineCode: { color: 'red' },
        blockCode: { color: 'green' },
      },
      wrap: false,
    });
    expect(ansi).toContain('\u001b[31minline'); // red
    expect(ansi).toContain('\u001b[32mblock'); // green
  });
});

describe('wrapping', () => {
  it('wraps paragraphs at width', () => {
    const out = strip('one two three four five six seven eight nine ten', {
      ...noColor,
      width: 10,
    });
    const lines = out.split('\n');
    expect(lines[0].length).toBeLessThanOrEqual(10);
  });

  it('respects no-wrap', () => {
    const out = strip('one two three four five six seven eight nine ten', {
      ...noColor,
      wrap: false,
      width: 5,
    });
    expect(out.split('\n')[0].length).toBeGreaterThan(20);
  });
});

describe('lists and tasks', () => {
  it('renders task list items', () => {
    const out = strip('- [ ] open\n- [x] done', noColor);
    expect(out).toContain('[ ] open');
    expect(out).toContain('[x] done');
  });
});

describe('tables', () => {
  it('renders gfm tables', () => {
    const md = `
| h1 | h2 |
| --- | --- |
| a | b |
`;
    const out = strip(md, { ...noColor, width: 30 });
    expect(out).toContain('| h1 | h2 |');
  });

  it('wraps table cells on spaces when width is small', () => {
    const md = `
| h1 | h2 |
| --- | --- |
| a b c d e f | g |
`;
    const out = strip(md, { ...noColor, width: 15, wrap: true });
    const lines = out.trim().split('\n').filter(l => l.startsWith('|'));
    // Expect more than header + divider + single body line => wrapping produced extra line
    expect(lines.length).toBeGreaterThan(3);
  });

  it('allows long words in cells to overflow (no hard break)', () => {
    const word = 'Supercalifragilistic';
    const md = `
| h1 | h2 |
| --- | --- |
| ${word} | x |
`;
    const out = strip(md, { ...noColor, width: 10, wrap: true });
    expect(out).toContain(word);
  });
});

describe('hyperlinks', () => {
  it('adds url suffix when hyperlinks are off', () => {
    const out = strip('[link](https://example.com)', { ...noColor });
    expect(out).toContain('link (https://example.com)');
  });
});
