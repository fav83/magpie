import Markdown from 'react-markdown';

export function SummaryView({ summary }: { summary: string }): React.JSX.Element {
  return (
    <div className="prose prose-sm max-w-none text-gray-800">
      <Markdown>{summary}</Markdown>
    </div>
  );
}
