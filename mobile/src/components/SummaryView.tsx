import Markdown from 'react-markdown';

interface SummaryViewProps {
  summary: string;
  title?: string;
  isStreaming?: boolean;
}

export function SummaryView({ summary, title, isStreaming }: SummaryViewProps): React.JSX.Element {
  return (
    <div>
      {title && <h2 className="text-lg font-semibold text-gray-800 mb-2">{title}</h2>}
      <div className="prose max-w-none text-gray-800">
        <Markdown>{summary}</Markdown>
        {isStreaming && <span className="animate-blink text-gray-400">&#9610;</span>}
      </div>
    </div>
  );
}
