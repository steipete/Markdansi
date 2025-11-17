import type {
	Blockquote,
	Code,
	Heading,
	Link,
	List,
	ListItem,
	Paragraph,
	Root,
	Table,
} from "mdast";
import stringWidth from "string-width";
import stripAnsi from "strip-ansi";
import { hyperlinkSupported, osc8 } from "./hyperlink.js";
import { parse } from "./parser.js";
import type { Styler } from "./theme.js";
import { createStyler, themes } from "./theme.js";
import type { RenderOptions, StyleIntent, Theme } from "./types.js";
import { visibleWidth, wrapText, wrapWithPrefix } from "./wrap.js";

type BorderStyle = "unicode" | "ascii" | "none";

type ResolvedOptions = {
	wrap: boolean;
	width?: number | undefined;
	color: boolean;
	hyperlinks: boolean;
	theme: Theme & { inlineCode?: StyleIntent; blockCode?: StyleIntent };
	highlighter?: RenderOptions["highlighter"];
	listIndent: number;
	quotePrefix: string;
	tableBorder: BorderStyle;
	tablePadding: number;
	tableDense: boolean;
	tableTruncate: boolean;
	tableEllipsis: string;
	codeBox: boolean;
	codeGutter: boolean;
	codeWrap: boolean;
};

type RenderContext = {
	options: ResolvedOptions;
	style: Styler;
};

function dedent(markdown: string): string {
	const lines = markdown.split("\n");
	const indents = lines
		.filter((l) => l.trim() !== "")
		.map((l) => l.match(/^[ \t]*/)?.[0].length ?? 0);
	if (indents.length === 0) return markdown;
	const minIndent = Math.min(...indents);
	if (minIndent === 0) return markdown;
	return lines.map((l) => l.slice(Math.min(minIndent, l.length))).join("\n");
}

function resolveOptions(userOptions: RenderOptions = {}): ResolvedOptions {
	const wrap = userOptions.wrap !== undefined ? userOptions.wrap : true;
	const baseWidth =
		userOptions.width ?? (wrap ? process.stdout.columns || 80 : undefined);
	const color =
		userOptions.color !== undefined ? userOptions.color : process.stdout.isTTY;
	// OSC hyperlinks require color support; if color is off, force hyperlinks off too
	const hyperlinks =
		userOptions.hyperlinks !== undefined
			? userOptions.hyperlinks
			: color && hyperlinkSupported();
	const effectiveHyperlinks = color ? hyperlinks : false;
	const baseTheme = themes.default ?? {};
	const userTheme =
		userOptions.theme && typeof userOptions.theme === "object"
			? userOptions.theme
			: themes[userOptions.theme || "default"] || baseTheme;
	const mergedTheme: ResolvedOptions["theme"] = {
		...baseTheme,
		...(userTheme || {}),
		inlineCode:
			userTheme?.inlineCode ||
			userTheme?.code ||
			baseTheme.inlineCode ||
			baseTheme.code ||
			{},
		blockCode:
			userTheme?.blockCode ||
			userTheme?.code ||
			baseTheme.blockCode ||
			baseTheme.code ||
			{},
	};
	const highlighter = userOptions.highlighter;
	const listIndent = userOptions.listIndent ?? 2;
	const quotePrefix = userOptions.quotePrefix ?? "│ ";
	const tableBorder = userOptions.tableBorder || "unicode";
	const tablePadding = userOptions.tablePadding ?? 1;
	const tableDense = userOptions.tableDense ?? false;
	const tableTruncate = userOptions.tableTruncate ?? true;
	const tableEllipsis = userOptions.tableEllipsis ?? "…";
	const codeBox = userOptions.codeBox ?? true;
	const codeGutter = userOptions.codeGutter ?? false;
	const codeWrap = userOptions.codeWrap ?? true;
	const resolved: ResolvedOptions = {
		wrap,
		color,
		hyperlinks: effectiveHyperlinks,
		theme: mergedTheme,
		highlighter,
		listIndent,
		quotePrefix,
		tableBorder,
		tablePadding,
		tableDense,
		tableTruncate,
		tableEllipsis,
		codeBox,
		codeGutter,
		codeWrap,
	};
	if (baseWidth !== undefined) resolved.width = baseWidth;
	return resolved;
}

const HR_WIDTH = 40;
const MAX_COL = 40;
const TABLE_BOX = {
	unicode: {
		topLeft: "┌",
		topRight: "┐",
		bottomLeft: "└",
		bottomRight: "┘",
		hSep: "─",
		vSep: "│",
		tSep: "┬",
		mSep: "┼",
		bSep: "┴",
		mLeft: "├",
		mRight: "┤",
	},
	ascii: {
		topLeft: "+",
		topRight: "+",
		bottomLeft: "+",
		bottomRight: "+",
		hSep: "-",
		vSep: "|",
		tSep: "+",
		mSep: "+",
		bSep: "+",
		mLeft: "+",
		mRight: "+",
	},
};

/**
 * Render Markdown input to an ANSI string.
 */
export function render(
	markdown: string,
	userOptions: RenderOptions = {},
): string {
	const options = resolveOptions(userOptions);
	const style = createStyler({ color: options.color });
	const tree = parse(dedent(markdown));
	const ctx: RenderContext = { options, style };
	const body = renderChildren(tree.children, ctx, 0, true).join("");
	return options.color ? body : stripAnsi(body);
}

/**
 * Create a reusable renderer with fixed options.
 */
export function createRenderer(options?: RenderOptions) {
	return (md: string) => render(md, options);
}

function renderChildren(
	children: Root["children"],
	ctx: RenderContext,
	indentLevel = 0,
	isTightList = false,
): string[] {
	const out: string[][] = [];
	for (let i = 0; i < children.length; i += 1) {
		const node = children[i];
		if (!node) continue;
		// Heuristic: some sources emit a standalone "[lang]" line before a fenced block.
		if (
			node.type === "paragraph" &&
			node.children.length === 1 &&
			node.children[0]?.type === "text"
		) {
			const langMatch = node.children[0]?.value.trim().match(/^\[([^\]]+)]$/);
			const next = children[i + 1];
			if (langMatch && next && next.type === "code" && !next.lang) {
				(next as Code).lang = langMatch[1];
				i += 1; // skip label paragraph, render the code next
				out.push(renderNode(next, ctx, indentLevel, isTightList));
				continue;
			}
		}
		out.push(renderNode(node, ctx, indentLevel, isTightList));
	}
	return out.flat();
}

function renderNode(
	node: Root["children"][number],
	ctx: RenderContext,
	indentLevel: number,
	isTightList: boolean,
): string[] {
	switch (node.type) {
		case "paragraph":
			return renderParagraph(node, ctx, indentLevel);
		case "heading":
			return renderHeading(node, ctx);
		case "thematicBreak":
			return renderHr(ctx);
		case "blockquote":
			return renderBlockquote(node, ctx, indentLevel);
		case "list":
			return renderList(node, ctx, indentLevel);
		case "listItem":
			return renderListItem(node, ctx, indentLevel, isTightList);
		case "code":
			return renderCodeBlock(node, ctx);
		case "table":
			return renderTable(node, ctx);
		default:
			return []; // inline handled elsewhere or intentionally skipped
	}
}

function renderParagraph(
	node: Paragraph,
	ctx: RenderContext,
	indentLevel: number,
): string[] {
	const text = renderInline(node.children, ctx);
	const prefix = " ".repeat(ctx.options.listIndent * indentLevel);
	const lines = wrapWithPrefix(
		text,
		ctx.options.width ?? 80,
		ctx.options.wrap,
		prefix,
	);
	return lines.map((l) => `${l}\n`);
}

function renderHeading(node: Heading, ctx: RenderContext): string[] {
	const text = renderInline(node.children, ctx);
	const styled = ctx.style(text, ctx.options.theme.heading);
	return [`\n${styled}\n`];
}

function renderHr(ctx: RenderContext): string[] {
	const width = ctx.options.wrap
		? Math.min(ctx.options.width ?? HR_WIDTH, HR_WIDTH)
		: HR_WIDTH;
	const line = "—".repeat(width);
	return [`${ctx.style(line, ctx.options.theme.hr)}\n`];
}

function renderBlockquote(
	node: Blockquote,
	ctx: RenderContext,
	indentLevel: number,
): string[] {
	// Render blockquote children as text, then wrap with the quote prefix so
	// wrapping accounts for prefix width.
	const inner = renderChildren(node.children, ctx, indentLevel);
	const prefix = ctx.style(ctx.options.quotePrefix, ctx.options.theme.quote);
	const text = inner.join("").trimEnd();
	const wrapped = wrapWithPrefix(
		text,
		ctx.options.width ?? 80,
		ctx.options.wrap,
		prefix,
	);
	return wrapped.map((l) => `${l}\n`);
}

function renderList(
	node: List,
	ctx: RenderContext,
	indentLevel: number,
): string[] {
	const tight = node.spread === false;
	const items = node.children.flatMap((item: ListItem, idx: number) =>
		renderListItem(
			item,
			ctx,
			indentLevel,
			tight,
			Boolean(node.ordered),
			node.start ?? 1,
			idx,
		),
	);
	return items;
}

function renderListItem(
	node: ListItem,
	ctx: RenderContext,
	indentLevel: number,
	tight: boolean,
	ordered = false,
	start = 1,
	idx = 0,
): string[] {
	const marker = ordered ? `${start + idx}.` : "-";
	const markerStyled = ctx.style(marker, ctx.options.theme.listMarker);
	const content = renderChildren(node.children, ctx, indentLevel + 1, tight)
		.join("")
		.trimEnd()
		.split("\n");

	// Drop leading blank lines so bullets prefix real content (e.g., headings in lists)
	while (content.length && (content[0]?.trim() ?? "") === "") {
		content.shift();
	}

	const isTask = typeof node.checked === "boolean";
	const box = isTask && node.checked ? "[x]" : "[ ]";
	const firstBullet =
		" ".repeat(ctx.options.listIndent * indentLevel) +
		(isTask
			? `${ctx.style(box, ctx.options.theme.listMarker)} `
			: `${markerStyled} `);

	const lines: string[] = [];
	content.forEach((line: string, i: number) => {
		const clean = line.replace(/^\s+/, "");
		const prefix =
			i === 0
				? firstBullet
				: `${" ".repeat(ctx.options.listIndent * indentLevel)}${" ".repeat(
						ctx.options.listIndent,
					)}`;
		lines.push(prefix + clean);
	});
	if (!tight) lines.push("");
	return lines.map((l) => `${l}\n`);
}

function renderCodeBlock(node: Code, ctx: RenderContext): string[] {
	const theme = ctx.options.theme.blockCode || ctx.options.theme.inlineCode;
	const lines = (node.value ?? "").split("\n");
	const gutterWidth = ctx.options.codeGutter
		? String(lines.length).length + 2
		: 0;
	const boxPadding = ctx.options.codeBox ? 4 : 0;
	const wrapLimit =
		ctx.options.codeWrap && ctx.options.wrap && ctx.options.width
			? Math.max(1, ctx.options.width - boxPadding - gutterWidth)
			: undefined; // undefined => no hard wrap limit
	const contentLines = lines.flatMap((line: string, idx: number) => {
		const segments =
			wrapLimit !== undefined ? wrapCodeLine(line, wrapLimit) : [line];
		return segments.map((segment: string, segIdx: number) => {
			const highlighted =
				ctx.options.highlighter?.(segment, node.lang ?? undefined) ??
				ctx.style(segment, theme);
			if (!ctx.options.codeGutter) return highlighted;
			const num =
				segIdx === 0
					? String(idx + 1).padStart(gutterWidth - 2, " ")
					: " ".repeat(gutterWidth - 1);
			return `${ctx.style(num, { dim: true })} ${highlighted}`;
		});
	});

	if (!ctx.options.codeBox) {
		return [`${contentLines.join("\n")}\n\n`];
	}

	// Boxed block
	const maxLine = Math.max(
		...contentLines.map((l: string) => visibleWidth(l)),
		0,
	);
	const minInner = node.lang ? node.lang.length + 2 : 0;
	const wrapTarget =
		ctx.options.codeWrap && ctx.options.width
			? Math.min(maxLine, Math.max(1, ctx.options.width - 4))
			: maxLine;
	const labelRaw = node.lang ? `[${node.lang}]` : "";
	const labelStyled = labelRaw ? ctx.style(labelRaw, { dim: true }) : "";
	const innerWidth = Math.max(
		ctx.options.codeWrap ? wrapTarget : maxLine,
		minInner,
		labelRaw.length,
	);
	const topPadding = Math.max(0, innerWidth - labelRaw.length);
	const top =
		labelRaw.length > 0
			? `┌ ${labelStyled}${" ".repeat(topPadding)}┐`
			: `┌ ${"─".repeat(innerWidth)} ┐`;
	const bottom = `└${"─".repeat(innerWidth + 2)}┘`;

	const boxLines = contentLines.map((ln: string) => {
		const pad = Math.max(0, innerWidth - visibleWidth(ln));
		const left = ctx.style("│ ", { dim: true });
		const right = ctx.style(" │", { dim: true });
		return `${left}${ln}${" ".repeat(pad)}${right}`;
	});

	return [`${top}\n${boxLines.join("\n")}\n${bottom}\n\n`];
}

function renderInline(
	children: Paragraph["children"],
	ctx: RenderContext,
): string {
	let out = "";
	for (const node of children) {
		switch (node.type) {
			case "text":
				out += node.value;
				break;
			case "emphasis":
				out += ctx.style(
					renderInline(node.children, ctx),
					ctx.options.theme.emph,
				);
				break;
			case "strong":
				out += ctx.style(
					renderInline(node.children, ctx),
					ctx.options.theme.strong,
				);
				break;
			case "delete":
				out += ctx.style(renderInline(node.children, ctx), { strike: true });
				break;
			case "inlineCode": {
				const codeTheme =
					ctx.options.theme.inlineCode || ctx.options.theme.blockCode;
				const content = ctx.style(node.value, codeTheme);
				out += content;
				break;
			}
			case "link":
				out += renderLink(node, ctx);
				break;
			case "break":
				out += "\n";
				break;
			default:
				if ("value" in node && typeof node.value === "string")
					out += node.value;
		}
	}
	return out;
}

function renderLink(node: Link, ctx: RenderContext): string {
	const label = renderInline(node.children, ctx) || node.url;
	const url = node.url || "";
	if (url.startsWith("mailto:")) {
		// Treat mailto autolinks as plain text to avoid unwanted styling in tables.
		return label;
	}
	if (ctx.options.hyperlinks && url) {
		return osc8(url, label);
	}
	if (url && label !== url) {
		return (
			ctx.style(label, ctx.options.theme.link) +
			ctx.style(` (${url})`, { dim: true })
		);
	}
	return ctx.style(label, ctx.options.theme.link);
}

function renderTable(node: Table, ctx: RenderContext): string[] {
	const header = node.children[0];
	if (!header) return [];
	const rows = node.children.slice(1);
	const cells = [header, ...rows].map((row) =>
		row.children.map((cell) => renderInline(cell.children, ctx)),
	);
	const colCount = Math.max(...cells.map((r) => r.length));
	const widths = new Array(colCount).fill(1);
	const aligns = node.align || [];
	const pad = ctx.options.tablePadding;
	const minContent = Math.max(1, ctx.options.tableEllipsis.length + 1);
	// ensure we always have room for at least one visible char + ellipsis + padding
	const minColWidth = Math.max(1, pad * 2 + minContent);

	cells.forEach((row: string[]) => {
		row.forEach((cell: string, idx: number) => {
			// Cap each column to MAX_COL but keep at least 1
			widths[idx] = Math.max(
				widths[idx],
				Math.min(MAX_COL, visibleWidth(cell)),
			);
		});
	});

	const totalWidth = widths.reduce((a, b) => a + b, 0) + 3 * colCount + 1;
	if (ctx.options.wrap && ctx.options.width && totalWidth > ctx.options.width) {
		// Shrink widest columns until the table fits; allow overflow if already at minima
		let over = totalWidth - ctx.options.width;
		while (over > 0) {
			const i = widths.indexOf(Math.max(...widths));
			if (widths[i] <= minColWidth) break;
			widths[i] -= 1;
			over -= 1;
		}
	}
	for (let i = 0; i < widths.length; i += 1) {
		if (widths[i] < minColWidth) widths[i] = minColWidth;
	}

	const renderRow = (row: string[], isHeader = false) => {
		const linesPerCol: string[][] = row.map((cell: string, idx: number) => {
			const padded = ` ${cell} `;
			const target = Math.max(minContent, widths[idx] - pad * 2);
			const cellText = ctx.options.tableTruncate
				? truncateCell(cell, target, ctx.options.tableEllipsis)
				: padded;
			const wrapped = wrapText(
				cellText,
				ctx.options.wrap ? target : Number.MAX_SAFE_INTEGER,
				ctx.options.wrap,
			);
			return wrapped.map((l) =>
				padCell(
					` ${l} `,
					widths[idx],
					aligns[idx] ?? "left",
					ctx.options.tablePadding,
				),
			);
		});
		// Row height = max wrapped lines in any column; pad shorter ones
		const height = Math.max(...linesPerCol.map((c) => c.length));
		const out: string[][] = [];
		for (let i = 0; i < height; i += 1) {
			const parts = linesPerCol.map((col: string[], idx: number) => {
				const content =
					col[i] ?? padCell("", widths[idx], aligns[idx] ?? "left");
				return isHeader
					? ctx.style(content, ctx.options.theme.tableHeader)
					: ctx.style(content, ctx.options.theme.tableCell);
			});
			out.push(parts);
		}
		return out;
	};

	const headerRows = renderRow(
		header.children.map((c) => renderInline(c.children, ctx)),
		true,
	);
	const bodyRows = rows.flatMap((r) =>
		renderRow(r.children.map((c) => renderInline(c.children, ctx))),
	);

	if (ctx.options.tableBorder === "none") {
		const lines = [...headerRows, ...bodyRows]
			.map((row) => row.join(" | "))
			.join("\n");
		return [`${lines}\n\n`];
	}

	const box = TABLE_BOX[ctx.options.tableBorder] || TABLE_BOX.unicode;
	const hLine = (sepMid: string, sepLeft: string, sepRight: string) =>
		`${sepLeft}${widths
			.map((w) => box.hSep.repeat(w))
			.join(sepMid)}${sepRight}\n`;

	const top = hLine(box.tSep, box.topLeft, box.topRight);
	const mid = hLine(box.mSep, box.mLeft, box.mRight);
	const bottom = hLine(box.bSep, box.bottomLeft, box.bottomRight);

	const renderFlat = (rowsArr: string[][]) =>
		rowsArr
			.map((r) => `${box.vSep}${r.map((c) => c).join(box.vSep)}${box.vSep}\n`)
			.join("");

	const dense = ctx.options.tableDense;
	const out = [
		top,
		renderFlat(headerRows),
		dense ? "" : mid,
		renderFlat(bodyRows),
		bottom,
		"\n",
	];
	return out;
}

function truncateCell(text: string, width: number, ellipsis: string): string {
	if (stringWidth(text) <= width) return text;
	if (width <= ellipsis.length) return ellipsis.slice(0, width);
	return text.slice(0, width - ellipsis.length) + ellipsis;
}

function wrapCodeLine(text: string, width: number): string[] {
	// Hard-wrap code even without spaces while keeping ANSI-safe width accounting.
	if (width <= 0) return [text];
	const parts: string[] = [];
	let current = "";
	for (const ch of [...text]) {
		const chWidth = stringWidth(ch);
		if (visibleWidth(current) + chWidth > width) {
			parts.push(current);
			current = ch;
			continue;
		}
		current += ch;
	}
	if (current !== "") parts.push(current);
	return parts.length ? parts : [""];
}

function padCell(
	text: string,
	width: number,
	align: "left" | "right" | "center" | null | undefined = "left",
	_padSpaces = 0,
): string {
	const core = text;
	const pad = width - stringWidth(stripAnsi(core));
	if (pad <= 0) return core;
	if (align === "right") return `${" ".repeat(pad)}${core}`;
	if (align === "center") {
		const left = Math.floor(pad / 2);
		const right = pad - left;
		return `${" ".repeat(left)}${core}${" ".repeat(right)}`;
	}
	return `${core}${" ".repeat(pad)}`;
}
