export type ColorName =
	| "black"
	| "red"
	| "green"
	| "yellow"
	| "blue"
	| "magenta"
	| "cyan"
	| "white"
	| `#${string}`
	| `${number}`;

export type StyleIntent = {
	color?: ColorName;
	bgColor?: ColorName;
	bold?: boolean;
	italic?: boolean;
	underline?: boolean;
	dim?: boolean;
	strike?: boolean;
};

export type Theme = {
	heading?: StyleIntent;
	strong?: StyleIntent;
	emph?: StyleIntent;
	inlineCode?: StyleIntent;
	blockCode?: StyleIntent;
	link?: StyleIntent;
	quote?: StyleIntent;
	hr?: StyleIntent;
	listMarker?: StyleIntent;
	tableHeader?: StyleIntent;
	tableCell?: StyleIntent;
};

export type ThemeName = "default" | "dim" | "bright";

export type Highlighter = (code: string, lang?: string) => string;

export interface RenderOptions {
	wrap?: boolean;
	width?: number;
	hyperlinks?: boolean;
	color?: boolean;
	theme?: ThemeName | Theme;
	highlighter?: Highlighter;
}

export declare function render(
	markdown: string,
	options?: RenderOptions,
): string;
export declare function createRenderer(
	options?: RenderOptions,
): (markdown: string) => string;
export declare function strip(
	markdown: string,
	options?: RenderOptions,
): string;
