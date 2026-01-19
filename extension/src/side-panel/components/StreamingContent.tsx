import ReactMarkdown from 'react-markdown';
import { useFontSize } from '../../hooks/useFontSize';

interface StreamingContentProps {
  content: string;
  isStreaming: boolean;
}

export function StreamingContent({ content, isStreaming }: StreamingContentProps): React.JSX.Element {
  const fontSize = useFontSize();

  return (
    <div
      className="text-gray-800 leading-relaxed markdown-content rounded-md"
      style={{ fontSize }}
    >
      {content ? (
        <>
          <ReactMarkdown>{content}</ReactMarkdown>
          {isStreaming && <span className="streaming-cursor">▊</span>}
        </>
      ) : isStreaming ? (
        <div className="text-gray-500">
          <span className="streaming-cursor">▊</span>
        </div>
      ) : (
        <div className="text-gray-400 italic">No content</div>
      )}
    </div>
  );
}
