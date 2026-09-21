/**
 * Minimal, safe formatter for model-generated prose.
 *
 * Gemini replies in light Markdown — paragraphs, bullet lists, **bold** for the
 * figures it wants to stress. Rendering that as a single flat string loses the
 * structure; rendering it with `dangerouslySetInnerHTML` would let model output
 * inject markup into the page.
 *
 * So this parses the handful of constructs that actually occur and builds React
 * elements. Anything it does not recognise falls through as plain text, which is
 * the safe direction to fail in.
 */

/** Split a line into text and **bold** / *italic* runs. */
function inline(line, keyPrefix) {
  const nodes = [];
  // Alternates: **bold** | *italic* | `code`
  const pattern = /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`\n]+`)/g;
  let lastIndex = 0;
  let match;
  let i = 0;

  while ((match = pattern.exec(line)) !== null) {
    if (match.index > lastIndex) nodes.push(line.slice(lastIndex, match.index));
    const token = match[0];
    const key = `${keyPrefix}-i${(i += 1)}`;

    if (token.startsWith('**')) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('`')) {
      nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < line.length) nodes.push(line.slice(lastIndex));
  return nodes.length ? nodes : [line];
}

const BULLET = /^\s*[-*•]\s+(.*)$/;
const ORDERED = /^\s*\d+[.)]\s+(.*)$/;

export default function RichText({ text, className = 'rich' }) {
  const lines = String(text ?? '').replace(/\r/g, '').split('\n');
  const blocks = [];

  let paragraph = [];
  let list = null; // { ordered: boolean, items: string[] }

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const joined = paragraph.join(' ').trim();
    if (joined) {
      blocks.push(
        <p key={`p${blocks.length}`} className="rich__p">
          {inline(joined, `p${blocks.length}`)}
        </p>,
      );
    }
    paragraph = [];
  };

  const flushList = () => {
    if (!list) return;
    const Tag = list.ordered ? 'ol' : 'ul';
    blocks.push(
      <Tag key={`l${blocks.length}`} className="rich__list">
        {list.items.map((item, i) => (
          <li key={i}>{inline(item, `l${blocks.length}-${i}`)}</li>
        ))}
      </Tag>,
    );
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    const bullet = line.match(BULLET);
    const ordered = line.match(ORDERED);

    if (bullet || ordered) {
      flushParagraph();
      const isOrdered = Boolean(ordered);
      // A change of list type starts a new list.
      if (!list || list.ordered !== isOrdered) {
        flushList();
        list = { ordered: isOrdered, items: [] };
      }
      list.items.push((bullet ?? ordered)[1]);
      continue;
    }

    flushList();
    // Strip Markdown heading markers — headings are too heavy for a chat reply.
    paragraph.push(line.replace(/^#{1,6}\s*/, ''));
  }

  flushParagraph();
  flushList();

  return <div className={className}>{blocks}</div>;
}
