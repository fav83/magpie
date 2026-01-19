import ReactMarkdown from 'react-markdown';

interface SummaryContentProps {
  content: string;
  fontSize: number;
}

export function SummaryContent({ content, fontSize }: SummaryContentProps): React.JSX.Element {
  return (
    <div
      className="text-gray-800 leading-relaxed markdown-content"
      style={{ fontSize }}
    >
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
