import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type NotesMarkdownProps = {
  body: string;
};

export function NotesMarkdown({ body }: NotesMarkdownProps) {
  const sections: Array<{ title: string; content: string }> = [];
  const heading = /^(#{1,3})\s+(.+)$/gm;
  let currentTitle = '';
  let cursor = 0;
  let match = heading.exec(body);

  if (!match) return <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>;

  while (match) {
    const content = body.slice(cursor, match.index).trim();
    if (currentTitle) sections.push({ title: currentTitle, content });
    else if (content) sections.push({ title: '', content });
    currentTitle = match[2].trim();
    cursor = heading.lastIndex;
    match = heading.exec(body);
  }
  const trailingContent = body.slice(cursor).trim();
  if (currentTitle) sections.push({ title: currentTitle, content: trailingContent });
  const firstSection = sections.findIndex((section) => Boolean(section.title));

  return (
    <div className="markdown-sections">
      {sections.map((section, index) => section.title ? (
        <details className="markdown-section" key={`${section.title}-${index}`} open={index === firstSection}>
          <summary>{section.title}<span aria-hidden="true">⌄</span></summary>
          <div className="markdown-section-content">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{section.content}</ReactMarkdown>
          </div>
        </details>
      ) : <div className="markdown-intro" key={`intro-${index}`}><ReactMarkdown remarkPlugins={[remarkGfm]}>{section.content}</ReactMarkdown></div>)}
    </div>
  );
}
