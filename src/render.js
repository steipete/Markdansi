import stringWidth from "string-width";
import stripAnsi from "strip-ansi";
import { hyperlinkSupported, osc8 } from "./hyperlink.js";
import { parse } from "./parser.js";
import { createStyler, themes } from "./theme.js";
import { visibleWidth, wrapText, wrapWithPrefix } from "./wrap.js";

function resolveOptions(userOptions = {}) {
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
	const theme =
		userOptions.theme && typeof userOptions.theme === "object"
			? userOptions.theme
			: themes[userOptions.theme || "default"] || themes.default;
	const highlighter = userOptions.highlighter;
	const listIndent = userOptions.listIndent ?? 2;
	const quotePrefix = userOptions.quotePrefix ?? "│ ";
	return {
		wrap,
		width: baseWidth,
		color,
		hyperlinks: effectiveHyperlinks,
		theme,
		highlighter,
		listIndent,
		quotePrefix,
	};
}

const HR_WIDTH = 40;
const MAX_COL = 40;

export function render(markdown, userOptions = {}) {
	const options = resolveOptions(userOptions);
	const style = createStyler({ color: options.color });
	const tree = parse(markdown);
	const ctx = { options, style };
	const body = renderChildren(tree.children, ctx, 0, true).join("");
	return options.color ? body : stripAnsi(body);
}

export function createRenderer(options) {
	return (md) => render(md, options);
}

function renderChildren(children, ctx, indentLevel = 0, isTightList = false) {
	const out = [];
	for (const node of children) {
		out.push(renderNode(node, ctx, indentLevel, isTightList));
	}
	return out.flat();
}

function renderNode(node, ctx, indentLevel, isTightList) {
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

function renderParagraph(node, ctx, indentLevel) {
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

function renderHeading(node, ctx) {
	const text = renderInline(node.children, ctx);
	const styled = ctx.style(text, ctx.options.theme.heading);
	return [`\n${styled}\n`];
}

function renderHr(ctx) {
	const width = ctx.options.wrap
		? Math.min(ctx.options.width ?? HR_WIDTH, HR_WIDTH)
		: HR_WIDTH;
	const line = "—".repeat(width);
	return [`${ctx.style(line, ctx.options.theme.hr)}\n`];
}

function renderBlockquote(node, ctx, indentLevel) {
	const content = renderChildren(node.children, ctx, indentLevel + 1);
	const prefix = ctx.style(ctx.options.quotePrefix, ctx.options.theme.quote);
	const lines = content
		.join("")
		.split("\n")
		.map((l) => (l === "" ? "" : prefix + l))
		.join("\n")
		.replace(/\n+$/, "");
	return [`${lines}\n`];
}

function renderList(node, ctx, indentLevel) {
	const tight = node.spread === false;
	const items = node.children.flatMap((item, idx) =>
		renderListItem(
			item,
			ctx,
			indentLevel,
			tight,
			node.ordered,
			node.start ?? 1,
			idx,
		),
	);
	return items;
}

function renderListItem(
	node,
	ctx,
	indentLevel,
	tight,
	ordered = false,
	start = 1,
	idx = 0,
) {
	const marker = ordered ? `${start + idx}.` : "-";
	const markerStyled = ctx.style(marker, ctx.options.theme.listMarker);
	const content = renderChildren(node.children, ctx, indentLevel + 1, tight)
		.join("")
		.trimEnd()
		.split("\n");

	const isTask = typeof node.checked === "boolean";
	const box = isTask ? (node.checked ? "[x]" : "[ ]") : null;
	const firstBullet =
		" ".repeat(ctx.options.listIndent * indentLevel) +
		(isTask
			? `${ctx.style(box, ctx.options.theme.listMarker)} `
			: `${markerStyled} `);

	const lines = [];
	content.forEach((line, i) => {
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

function renderCodeBlock(node, ctx) {
	const theme = ctx.options.theme.blockCode || ctx.options.theme.inlineCode;
	const label = node.lang ? ctx.style(`[${node.lang}] `, { dim: true }) : "";
	let body = node.value ?? "";
	if (ctx.options.highlighter) {
		const res = ctx.options.highlighter(body, node.lang);
		if (typeof res === "string") body = res;
	} else {
		body = body
			.split("\n")
			.map((l) => ctx.style(l, theme))
			.join("\n");
	}
	return [`${label}${body}\n\n`];
}

function renderInline(children, ctx) {
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
				if (node.value) out += node.value;
		}
	}
	return out;
}

function renderLink(node, ctx) {
	const label = renderInline(node.children, ctx) || node.url;
	const url = node.url || "";
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

function renderTable(node, ctx) {
	const header = node.children[0];
	const rows = node.children.slice(1);
	const cells = [header, ...rows].map((row) =>
		row.children.map((cell) => renderInline(cell.children, ctx)),
	);
	const colCount = Math.max(...cells.map((r) => r.length));
	const widths = new Array(colCount).fill(1);
	const aligns = node.align || [];

	cells.forEach((row) => {
		row.forEach((cell, idx) => {
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
			if (widths[i] <= 1) break;
			widths[i] -= 1;
			over -= 1;
		}
	}

	const renderRow = (row, isHeader = false) => {
		const linesPerCol = row.map((cell, idx) =>
			wrapText(cell, widths[idx], ctx.options.wrap).map((l) =>
				padCell(l, widths[idx], aligns[idx]),
			),
		);
		// Row height = max wrapped lines in any column; pad shorter ones
		const height = Math.max(...linesPerCol.map((c) => c.length));
		const out = [];
		for (let i = 0; i < height; i += 1) {
			const parts = linesPerCol.map((col, idx) => {
				const content = col[i] ?? padCell("", widths[idx], aligns[idx]);
				return isHeader
					? ctx.style(content, ctx.options.theme.tableHeader)
					: ctx.style(content, ctx.options.theme.tableCell);
			});
			out.push(`| ${parts.join(" | ")} |\n`);
		}
		return out;
	};

	const headerRows = renderRow(
		header.children.map((c) => renderInline(c.children, ctx)),
		true,
	);
	const divider = `| ${widths.map((w) => "—".repeat(w)).join(" | ")} |\n`;
	const bodyRows = rows.flatMap((r) =>
		renderRow(r.children.map((c) => renderInline(c.children, ctx))),
	);

	return [...headerRows, divider, ...bodyRows, "\n"];
}

function padCell(text, width, align = "left") {
	const pad = width - stringWidth(stripAnsi(text));
	if (pad <= 0) return text;
	if (align === "right") return `${" ".repeat(pad)}${text}`;
	if (align === "center") {
		const left = Math.floor(pad / 2);
		const right = pad - left;
		return `${" ".repeat(left)}${text}${" ".repeat(right)}`;
	}
	return `${text}${" ".repeat(pad)}`;
}
