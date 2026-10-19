import { Fragment } from "react";

// Renders plain text with http(s) addresses turned into links that open in a
// new tab. Used for checklist step notes copied from Myndlist, which may hold a
// "where to buy" link. Anything that doesn't parse as an http(s) URL stays
// text, so a note can never produce a javascript: or other unsafe link.

const URL_PATTERN = /\bhttps?:\/\/[^\s<>"'`]+/gi;
const TRAILING_PUNCTUATION = /[.,;:!?]+$/;
const MAX_LABEL = 40;

type Part = { kind: "text"; value: string } | { kind: "link"; href: string; label: string };

function trimUrl(raw: string): string {
  let url = raw.replace(TRAILING_PUNCTUATION, "");
  if (url.endsWith(")") && !url.includes("(")) url = url.slice(0, -1).replace(TRAILING_PUNCTUATION, "");
  return url;
}

function linkLabel(url: URL): string {
  const host = url.hostname.replace(/^www\./, "");
  const label = host + (url.pathname === "/" ? "" : url.pathname) + url.search;
  return label.length > MAX_LABEL ? `${label.slice(0, MAX_LABEL - 1)}…` : label;
}

export function splitLinks(text: string): Part[] {
  const parts: Part[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const raw = trimUrl(match[0]);
    const start = match.index ?? 0;
    let parsed: URL | null = null;
    try {
      parsed = new URL(raw);
    } catch {
      parsed = null;
    }
    if (!parsed || (parsed.protocol !== "http:" && parsed.protocol !== "https:")) continue;
    if (start > last) parts.push({ kind: "text", value: text.slice(last, start) });
    parts.push({ kind: "link", href: parsed.href, label: linkLabel(parsed) });
    last = start + raw.length;
  }
  if (last < text.length) parts.push({ kind: "text", value: text.slice(last) });
  return parts;
}

export function LinkifiedText({ text, linkStyle }: { text: string; linkStyle?: React.CSSProperties }) {
  return (
    <>
      {splitLinks(text).map((part, i) =>
        part.kind === "text" ? (
          <Fragment key={i}>{part.value}</Fragment>
        ) : (
          <a
            key={i}
            href={part.href}
            title={part.href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            onClick={(e) => e.stopPropagation()}
            className="underline underline-offset-2"
            style={linkStyle}
          >
            {part.label}
          </a>
        )
      )}
    </>
  );
}
