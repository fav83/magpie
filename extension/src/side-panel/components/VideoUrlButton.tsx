interface VideoUrlButtonProps {
  url: string;
  fontSize: number;
}

export function VideoUrlButton({ url, fontSize }: VideoUrlButtonProps): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={() => { void chrome.tabs.update({ url }); }}
      className="text-blue-500 hover:text-blue-700 hover:underline truncate block text-left flex-1 min-w-0"
      style={{ fontSize }}
      title={url}
    >
      {url}
    </button>
  );
}
