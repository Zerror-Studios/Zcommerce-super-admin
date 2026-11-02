/**
 * Ask ZCOM answer renderer for staff (backend PRD-026 FR-7.2, guide §12;
 * ported from the dashboard's renderer, no Markdown dependency)
 *
 * Answers are plain text with simple Markdown. This renders exactly that
 * subset as React elements: paragraphs, `**bold**`, `*italic*`,
 * `` `code` ``, bullet and numbered lists, simple pipe tables, and
 * `[text](/path)` links to console paths (routed in-app). Headings render
 * as bold lines. Store names the answer mentions link to Store detail when
 * they match a loaded store. No raw HTML, no images, no external links;
 * nothing is ever set as HTML.
 */

import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { consolePath, splitStoreNames, type NamedStore } from "../../lib/ask-zcom-platform.util";

// ─── Types ────────────────────────────────────────────────────────────────

type Block =
  | { kind: "paragraph"; lines: string[] }
  | { kind: "heading"; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "table"; header: string[]; rows: string[][] };

interface AssistantMarkdownProps {
  text: string;
  /** Stores whose names become links (`/stores/<id>`). */
  stores?: NamedStore[];
  /** Called after an in-app link is followed (the panel closes). */
  onNavigate?: () => void;
}

interface InlineContext {
  stores: NamedStore[];
  onNavigate?: () => void;
}

// ─── Parsing ──────────────────────────────────────────────────────────────

const BULLET_PATTERN = /^\s*[-*•]\s+(.*)$/;
const NUMBERED_PATTERN = /^\s*\d+[.)]\s+(.*)$/;
const HEADING_PATTERN = /^\s{0,3}#{1,6}\s+(.*)$/;
const TABLE_ROW_PATTERN = /^\s*\|.*\|\s*$/;
const TABLE_DIVIDER_PATTERN = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

/** Groups the answer's lines into blocks. */
function parseBlocks(text: string): Block[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const heading = HEADING_PATTERN.exec(line);
    if (heading) {
      blocks.push({ kind: "heading", text: heading[1] });
      index += 1;
      continue;
    }

    // A table: a pipe row followed by a divider row
    if (TABLE_ROW_PATTERN.test(line) && index + 1 < lines.length && TABLE_DIVIDER_PATTERN.test(lines[index + 1])) {
      const header = splitRow(line);
      const rows: string[][] = [];
      index += 2;
      while (index < lines.length && TABLE_ROW_PATTERN.test(lines[index])) {
        rows.push(splitRow(lines[index]));
        index += 1;
      }
      blocks.push({ kind: "table", header, rows });
      continue;
    }

    const bullet = BULLET_PATTERN.exec(line);
    const numbered = NUMBERED_PATTERN.exec(line);
    if (bullet || numbered) {
      const ordered = !bullet;
      const pattern = ordered ? NUMBERED_PATTERN : BULLET_PATTERN;
      const items: string[] = [];
      while (index < lines.length) {
        const match = pattern.exec(lines[index]);
        if (!match) break;
        items.push(match[1]);
        index += 1;
      }
      blocks.push({ kind: "list", ordered, items });
      continue;
    }

    const paragraph: string[] = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !HEADING_PATTERN.test(lines[index]) &&
      !BULLET_PATTERN.test(lines[index]) &&
      !NUMBERED_PATTERN.test(lines[index]) &&
      !TABLE_ROW_PATTERN.test(lines[index])
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    if (paragraph.length === 0) {
      // A lone pipe row that isn't a table: keep it as text
      paragraph.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ kind: "paragraph", lines: paragraph });
  }
  return blocks;
}

// ─── Inline ───────────────────────────────────────────────────────────────

const INLINE_PATTERN = /(\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|\*([^*\s][^*]*)\*)/g;

const LINK_CLASSES = "font-medium text-brand underline-offset-2 hover:underline";

/** Plain text, with store names linked to Store detail. */
function renderText(text: string, key: string, context: InlineContext): ReactNode[] {
  return splitStoreNames(text, context.stores).map((segment, index) =>
    segment.kind === "store" ? (
      <Link
        key={`${key}-s${index}`}
        to={`/stores/${segment.storeId}`}
        onClick={context.onNavigate}
        className={LINK_CLASSES}
      >
        {segment.text}
      </Link>
    ) : (
      segment.text
    ),
  );
}

function renderInline(text: string, keyPrefix: string, context: InlineContext): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  INLINE_PATTERN.lastIndex = 0;
  while ((match = INLINE_PATTERN.exec(text))) {
    if (match.index > last) nodes.push(...renderText(text.slice(last, match.index), `${keyPrefix}-t${last}`, context));
    const key = `${keyPrefix}-${match.index}`;
    if (match[2] != null) {
      nodes.push(
        <strong key={key} className="font-semibold">
          {renderText(match[2], key, context)}
        </strong>,
      );
    } else if (match[3] != null) {
      nodes.push(
        <code key={key} className="rounded bg-surface-sunken px-1 font-mono text-caption">
          {match[3]}
        </code>,
      );
    } else if (match[4] != null) {
      // Only console paths become links; anything else is its text
      const path = consolePath(match[5]);
      nodes.push(
        path ? (
          <Link key={key} to={path} onClick={context.onNavigate} className={LINK_CLASSES}>
            {match[4]}
          </Link>
        ) : (
          match[4]
        ),
      );
    } else if (match[6] != null) {
      nodes.push(<em key={key}>{renderText(match[6], key, context)}</em>);
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push(...renderText(text.slice(last), `${keyPrefix}-t${last}`, context));
  return nodes;
}

// ─── Component ────────────────────────────────────────────────────────────

export function AssistantMarkdown({ text, stores = [], onNavigate }: AssistantMarkdownProps) {
  const blocks = parseBlocks(text);
  const context: InlineContext = { stores, onNavigate };
  return (
    <div className="flex flex-col gap-2 text-body text-fg">
      {blocks.map((block, index) => {
        const key = `b${index}`;
        if (block.kind === "heading") {
          return (
            <p key={key} className="font-semibold">
              {renderInline(block.text, key, context)}
            </p>
          );
        }
        if (block.kind === "list") {
          const ListTag = block.ordered ? "ol" : "ul";
          return (
            <ListTag key={key} className={`flex flex-col gap-1 pl-5 ${block.ordered ? "list-decimal" : "list-disc"}`}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInline(item, `${key}-${itemIndex}`, context)}</li>
              ))}
            </ListTag>
          );
        }
        if (block.kind === "table") {
          return (
            <div key={key} className="overflow-x-auto">
              <table className="w-full text-left text-label">
                <thead>
                  <tr className="text-fg-muted">
                    {block.header.map((cell, cellIndex) => (
                      <th key={cellIndex} className="py-1 pr-3 font-medium">
                        {renderInline(cell, `${key}-h${cellIndex}`, context)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-t border-line-subtle">
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex} className="py-1 pr-3 num">
                          {renderInline(cell, `${key}-${rowIndex}-${cellIndex}`, context)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        return (
          <p key={key} className="whitespace-pre-line">
            {renderInline(block.lines.join("\n"), key, context)}
          </p>
        );
      })}
    </div>
  );
}

export default AssistantMarkdown;
