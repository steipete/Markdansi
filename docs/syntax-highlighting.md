# Syntax highlighting

Markdansi does not bundle a syntax highlighter. Supply a `highlighter(code, language)` function to `createRenderer()` when fenced code should use syntax colors.

The hook may add ANSI styling, but it must preserve the number and placement of newlines. Markdansi applies code boxes, gutters, and wrapping after the hook returns.

## Shiki example

Install Shiki next to Markdansi:

```sh
npm install markdansi shiki
```

Create a highlighter for the languages your application accepts:

````js
import { createRenderer } from "markdansi";
import { bundledLanguages, bundledThemes, createHighlighter } from "shiki";

const shiki = await createHighlighter({
  themes: [bundledThemes["github-dark"]],
  langs: [bundledLanguages.typescript, bundledLanguages.swift],
});

const render = createRenderer({
  highlighter: (code, language) => {
    if (!language) return code;
    const normalized = language.toLowerCase();
    if (!["ts", "typescript", "swift"].includes(normalized)) return code;

    const { tokens } = shiki.codeToTokens(code, {
      lang: normalized === "swift" ? "swift" : "ts",
      theme: "github-dark",
    });

    return tokens
      .map((line) =>
        line
          .map((token) =>
            token.color
              ? `\u001b[38;2;${parseInt(token.color.slice(1, 3), 16)};${parseInt(
                  token.color.slice(3, 5),
                  16,
                )};${parseInt(token.color.slice(5, 7), 16)}m${token.content}\u001b[39m`
              : token.content,
          )
          .join(""),
      )
      .join("\n");
  },
});

console.log(render("```ts\nconst value: number = 1;\n```"));
````

Keep the language allowlist narrow when the Markdown language tag comes from an untrusted source. The hook should return the original code for unsupported or missing language tags.
