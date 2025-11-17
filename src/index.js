import { createRenderer, render as renderMarkdown } from "./render.js";
import { themes } from "./theme.js";

export { renderMarkdown as render, createRenderer, themes };

export function strip(markdown, options = {}) {
	return renderMarkdown(markdown, {
		...options,
		color: false,
		hyperlinks: false,
	});
}
