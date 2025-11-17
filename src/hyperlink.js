import supportsHyperlinks from "supports-hyperlinks";

/**
 * Detect OSC-8 hyperlink support for a given stream (defaults to stdout).
 */
export function hyperlinkSupported(stream = process.stdout) {
	if (supportsHyperlinks && typeof supportsHyperlinks.stdout === "function") {
		return supportsHyperlinks.stdout(stream);
	}
	return false;
}

export function osc8(url, text) {
	return `\u001B]8;;${url}\u0007${text}\u001B]8;;\u0007`;
}
