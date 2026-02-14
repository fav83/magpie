import Markdown from 'react-markdown';

interface SummaryViewProps {
  summary: string;
  isStreaming?: boolean;
}

export function SummaryView({ summary, isStreaming }: SummaryViewProps): React.JSX.Element {
  return (
    <div className="prose max-w-none text-gray-800">
      <Markdown>{summary}</Markdown>
      {isStreaming && <span className="animate-blink text-gray-400">&#9610;</span>}
    </div>
  );
}
