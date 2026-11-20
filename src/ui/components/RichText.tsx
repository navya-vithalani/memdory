import { Component, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface ErrorBoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class RichTextErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.warn('RichText LaTeX rendering error caught:', error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

type RichTextProps = {
  text: string;
  className?: string;
};

export function RichText({ text, className = '' }: RichTextProps) {
  if (!text) return null;

  const fallback = <span className={`rich-text-fallback ${className}`} style={{ whiteSpace: 'pre-wrap' }}>{text}</span>;

  return (
    <RichTextErrorBoundary fallback={fallback}>
      <div className={`rich-text-content ${className}`}>
        <ReactMarkdown
          remarkPlugins={[remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={{
            p: ({ children }) => <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{children}</p>
          }}
        >
          {text}
        </ReactMarkdown>
      </div>
    </RichTextErrorBoundary>
  );
}
