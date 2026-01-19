import { DeleteIcon, CancelIcon, ChevronDownIcon, ChevronRightIcon } from './Icons';
import { Tooltip } from './Tooltip';

interface ActionButtonConfig {
  type: 'delete' | 'cancel';
  onClick: () => void;
  title: string;
}

interface AccordionHeaderProps {
  title: string;
  promptName: string;
  isExpanded: boolean;
  onToggle: () => void;
  actionButton?: ActionButtonConfig | undefined;
  fontSize: number;
  isEdited?: boolean;
}

export function AccordionHeader({
  title,
  promptName,
  isExpanded,
  onToggle,
  actionButton,
  fontSize,
  isEdited = false,
}: AccordionHeaderProps): React.JSX.Element {
  // Delete button: visible only on hover or when expanded
  // Cancel button: always visible (for streaming items)
  const showActionButton = actionButton && (
    actionButton.type === 'cancel' || isExpanded
  );

  return (
    <div className="group flex items-start gap-1.5 px-2 py-1.5" style={{ fontSize }}>
      <button
        type="button"
        onClick={onToggle}
        className="flex-1 min-w-0 text-left flex items-start gap-1.5"
      >
        <Tooltip content={isExpanded ? 'Collapse' : 'Expand'} position="bottom">
          <span
            className="text-gray-400 mt-0.5 flex-shrink-0"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? (
              <ChevronDownIcon className="w-3 h-3" />
            ) : (
              <ChevronRightIcon className="w-3 h-3" />
            )}
          </span>
        </Tooltip>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 truncate" title={title}>
            {title}
          </p>
          <p className="text-gray-500 truncate">
            Prompt: {promptName}{isEdited && <span className="text-gray-400 italic"> (edited)</span>}
          </p>
        </div>
      </button>
      {actionButton && (
        <Tooltip content={actionButton.title} position="bottom">
          <button
            type="button"
            onClick={actionButton.onClick}
            aria-label={actionButton.title}
            className={`flex-shrink-0 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-all ${
              showActionButton
                ? 'opacity-100'
                : 'opacity-0 w-0 p-0 overflow-hidden group-hover:opacity-100 group-hover:w-auto group-hover:p-1'
            }`}
          >
            {actionButton.type === 'cancel' ? (
              <CancelIcon className="w-4 h-4" />
            ) : (
              <DeleteIcon className="w-4 h-4" />
            )}
          </button>
        </Tooltip>
      )}
    </div>
  );
}
