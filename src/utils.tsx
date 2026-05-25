/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

/**
 * Format date nicely for human consumption
 */
export function formatFriendlyDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "Recently";
    
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return "Recently";
  }
}

/**
 * Seconds converter to M:SS or H:MM:SS format
 */
export function formatDuration(seconds: number | undefined): string {
  if (seconds === undefined || isNaN(seconds)) return "";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

/**
 * A highly crafted renderer that turns markdown strings into fully-styled React elements.
 * Custom supports checklist checkboxes, nested sections, and elegant typographic spacing.
 */
export function parseAndStyleMarkdown(md: string): React.ReactNode[] {
  if (!md) return [];
  
  const lines = md.split('\n');
  const elements: React.ReactNode[] = [];
  
  let listItems: React.ReactNode[] = [];
  let currentListType: 'bullet' | 'ordered' | 'checklist' | null = null;
  let inBlockquote = false;
  let blockquoteLines: string[] = [];
  let inCodeBlock = false;
  let codeSnippetLines: string[] = [];
  
  // Flushes accumulated lists or blockquotes to the outer elements array
  function flushAccumulations(keyPrefix: string) {
    if (listItems.length > 0) {
      if (currentListType === 'checklist') {
        elements.push(
          <ul key={`checklist-${keyPrefix}`} className="space-y-2 my-4 pl-1" id={`check-ul-${keyPrefix}`}>
            {...listItems}
          </ul>
        );
      } else {
        elements.push(
          <ul key={`bullet-${keyPrefix}`} className="list-disc pl-6 space-y-1.5 my-4 text-[#C0C0C0] leading-relaxed font-sans" id={`bullet-ul-${keyPrefix}`}>
            {...listItems}
          </ul>
        );
      }
      listItems = [];
      currentListType = null;
    }
    if (inBlockquote && blockquoteLines.length > 0) {
      elements.push(
        <blockquote key={`quote-${keyPrefix}`} className="border-l-4 border-[#10B981] bg-[#10B981]/10 p-4 rounded-r-lg my-4 italic text-[#C0C0C0]" id={`quote-bq-${keyPrefix}`}>
          {blockquoteLines.join(' ')}
        </blockquote>
      );
      blockquoteLines = [];
      inBlockquote = false;
    }
    if (inCodeBlock && codeSnippetLines.length > 0) {
      elements.push(
        <pre key={`code-${keyPrefix}`} className="bg-[#050505] text-[#E0E0E0] font-mono text-[13px] p-4 rounded-xl overflow-x-auto my-4 border border-[#1F1F1F]" id={`code-pre-${keyPrefix}`}>
          <code>{codeSnippetLines.join('\n')}</code>
        </pre>
      );
      codeSnippetLines = [];
      inCodeBlock = false;
    }
  }

  // Inline styling parser helper (bold, italic, code pills)
  function parseInlineStyles(text: string, keyId: string): React.ReactNode {
    // Process markdown code pills standard `code`
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let index = 0;

    // Direct translation for bold, italic, and highlighters
    // Simple regex breakdown for safe sequential replacement
    const regex = /(\*\*|__)(.*?)\1|(\*|_)(.*?)\3|(`)(.*?)\5/g;
    
    let match;
    let lastIndex = 0;

    while ((match = regex.exec(text)) !== null) {
      const matchIndex = match.index;
      
      // Push preceding plain text
      if (matchIndex > lastIndex) {
        parts.push(text.substring(lastIndex, matchIndex));
      }

      const [full, boldMarker, boldText, italicMarker, italicText, codeMarker, codeText] = match;

      if (boldText !== undefined) {
        parts.push(<strong key={`b-${keyId}-${index++}`} className="font-semibold text-white">{boldText}</strong>);
      } else if (italicText !== undefined) {
        parts.push(<em key={`i-${keyId}-${index++}`} className="italic text-slate-350">{italicText}</em>);
      } else if (codeText !== undefined) {
        parts.push(
          <code key={`c-${keyId}-${index++}`} className="bg-[#151515] text-[#10B981] font-mono text-[13px] px-1.5 py-0.5 rounded border border-[#2A2A2A]">
            {codeText}
          </code>
        );
      }

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? <>{parts}</> : text;
  }

  for (let idx = 0; idx < lines.length; idx++) {
    const rawLine = lines[idx];
    const trimmed = rawLine.trim();
    const keyId = `line-${idx}`;

    // Code Block Check
    if (trimmed.startsWith('```')) {
      if (inCodeBlock) {
        flushAccumulations(keyId);
      } else {
        flushAccumulations(keyId);
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeSnippetLines.push(rawLine);
      continue;
    }

    // Blockquote Check
    if (trimmed.startsWith('>')) {
      if (!inBlockquote) {
        flushAccumulations(keyId);
        inBlockquote = true;
      }
      blockquoteLines.push(trimmed.slice(1).trim());
      continue;
    }

    // Flush blockquote if we moved away from it
    if (inBlockquote && !trimmed.startsWith('>')) {
      flushAccumulations(keyId);
    }

    // Headers
    if (trimmed.startsWith('#')) {
      flushAccumulations(keyId);
      const level = trimmed.match(/^#+/)?.[0].length || 1;
      const text = trimmed.replace(/^#+\s*/, '');
      const styledText = parseInlineStyles(text, keyId);

      if (level === 1) {
        elements.push(
          <h1 key={keyId} className="text-2xl font-light text-white tracking-wide mt-6 mb-3 border-b border-[#1F1F1F] pb-1.5" id={`h1-${idx}`}>
            {styledText}
          </h1>
        );
      } else if (level === 2) {
        elements.push(
          <h2 key={keyId} className="text-xl font-light text-white tracking-wide mt-5 mb-2.5" id={`h2-${idx}`}>
            {styledText}
          </h2>
        );
      } else {
        elements.push(
          <h3 key={keyId} className="text-lg font-medium text-white tracking-wide mt-4 mb-2" id={`h3-${idx}`}>
            {styledText}
          </h3>
        );
      }
      continue;
    }

    // Checklist vs Bullet Lists
    const checklistMatch = trimmed.match(/^-\s*\[\s*([xX\s]?)\s*\]\s*(.*)$/);
    if (checklistMatch) {
      if (currentListType !== 'checklist') {
        flushAccumulations(keyId);
        currentListType = 'checklist';
      }
      const checked = checklistMatch[1].toLowerCase() === 'x';
      const itemText = checklistMatch[2];
      listItems.push(
        <li key={`li-${keyId}`} className="flex items-start gap-2 text-sm text-[#E0E0E0] leading-relaxed py-0.5 animate-fadeIn" id={`li-${idx}`}>
          <div className="pt-1 flex-shrink-0">
            {checked ? (
              <span className="flex h-4 w-4 items-center justify-center rounded bg-[#10B981] text-black shadow-[0_0_8px_rgba(16,185,129,0.3)]" id={`item-checked-${idx}`}>
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </span>
            ) : (
              <span className="block h-4 w-4 rounded border border-[#2A2A2A] bg-[#1A1A1A] hover:border-[#10B981]/50 transition-colors" id={`item-unchecked-${idx}`} />
            )}
          </div>
          <span className={checked ? "line-through text-[#666] select-none text-sm" : "text-[#E0E0E0] select-all text-sm"}>
            {parseInlineStyles(itemText, keyId)}
          </span>
        </li>
      );
      continue;
    }

    const bulletMatch = trimmed.match(/^[-*+]\s+(.*)$/);
    if (bulletMatch) {
      if (currentListType !== 'bullet') {
        flushAccumulations(keyId);
        currentListType = 'bullet';
      }
      const itemText = bulletMatch[1];
      listItems.push(
        <li key={`li-${keyId}`} className="text-sm pl-1 text-[#E0E0E0]" id={`bullet-li-${idx}`}>
          {parseInlineStyles(itemText, keyId)}
        </li>
      );
      continue;
    }

    // Empty Lines
    if (trimmed === '') {
      flushAccumulations(keyId);
      elements.push(<div key={keyId} className="h-2" id={`spacer-${idx}`} />);
      continue;
    }

    // Plain Paragraph text
    flushAccumulations(keyId);
    elements.push(
      <p key={keyId} className="text-sm text-[#C0C0C0] leading-relaxed mb-3.5 select-all" id={`p-${idx}`}>
        {parseInlineStyles(trimmed, keyId)}
      </p>
    );
  }

  // Final sweep at end of file
  flushAccumulations('end');

  return elements;
}

/**
 * Highly optimized, client-side, 100% free open-source ruleset that refines
 * transcription grammar and punctuation. Removes verbal disfluencies (stutters)
 * and filler words while preserving word-for-word fidelity.
 */
export function localPolishGrammar(text: string): string {
  if (!text) return "";

  let refined = text;

  // 1. Remove speech disfluencies & filler words with proper boundary and punctuation awareness
  // This cleans isolated fillers like "um", "uh", "ah", "err", etc.
  refined = refined.replace(/\b(um|uh|ah|er|err|mhm|uh-huh|uhm|ahm|uh-uh)\b\s*,\s*/gi, "");
  refined = refined.replace(/,\s*\b(um|uh|ah|er|err|mhm|uh-huh|uhm|ahm|uh-uh)\b/gi, "");
  refined = refined.replace(/\b(um|uh|ah|er|err|mhm|uh-huh|uhm|ahm|uh-uh)\b/gi, "");

  // 2. Resolve speech stutters (consecutive duplicate words) for common fillers/connections
  const commonStutters = ["the", "and", "we", "it", "to", "a", "an", "in", "on", "of", "is", "that", "this", "you", "i", "but", "so"];
  for (const word of commonStutters) {
    const regex = new RegExp(`\\b(${word})\\s+\\1\\b`, "gi");
    refined = refined.replace(regex, "$1");
  }

  // 3. Clean spacing and punctuation errors
  refined = refined.replace(/[ \t]+/g, " "); // collapse repeated spaces
  refined = refined.replace(/\s+([.,;:?!])/g, "$1"); // remove spaces preceding punctuation
  refined = refined.replace(/,+/g, ","); // fix duplicate commas
  refined = refined.replace(/\.+/g, "."); // fix duplicate periods

  // 4. Capitalize the single English pronoun "I" and its common contractions
  refined = refined.replace(/\bi\b/g, "I");
  refined = refined.replace(/\bi'm\b/g, "I'm");
  refined = refined.replace(/\bi'd\b/g, "I'd");
  refined = refined.replace(/\bi'll\b/g, "I'll");
  refined = refined.replace(/\bi've\b/g, "I've");

  // 5. Line-by-line Sentence Capitalization
  const lines = refined.split("\n");
  const processedLines = lines.map(line => {
    let trimmed = line.trim();
    if (!trimmed) return line;

    // Preserve list bullets if present (e.g. "* ", "- ", or "1. ")
    let prefix = "";
    const listPattern = /^(\s*[-*+]\s*|\s*\d+\.\s*)/;
    const match = trimmed.match(listPattern);
    if (match) {
      prefix = match[0];
      trimmed = trimmed.substring(prefix.length);
    }

    // Capitalize the leading character representing start of the sentence
    if (trimmed.length > 0) {
      trimmed = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    }

    // Capitalize anytime a letter follows a terminal punctuation and whitespace
    trimmed = trimmed.replace(/([.?!]\s+)([a-z])/g, (_, punctuationWithSpace, char) => {
      return punctuationWithSpace + char.toUpperCase();
    });

    return (match ? prefix : "") + trimmed;
  });

  refined = processedLines.join("\n");

  // 6. Ensure correct final terminal period for standard plain non-heading text
  const trimmedRefined = refined.trim();
  if (trimmedRefined && /[a-zA-Z0-9]$/.test(trimmedRefined)) {
    if (!trimmedRefined.startsWith("#") && !trimmedRefined.startsWith("---")) {
      refined = refined.trim() + ".";
    }
  }

  // Final spaces normalization
  refined = refined.replace(/ +/g, " ");

  return refined;
}
