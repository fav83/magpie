import { useState, useEffect, useRef } from 'react';

const COPY_SUCCESS_DURATION_MS = 2000;

interface SpeedDialFABProps {
  visible: boolean;
  onShare: () => void;
  onCopy: () => void;
}

interface SpeedDialItemProps {
  label: string;
  ariaLabel: string;
  open: boolean;
  onClick: () => void;
  delay?: string;
  icon: React.ReactNode;
}

function SpeedDialItem({ label, ariaLabel, open, onClick, delay, icon }: SpeedDialItemProps): React.JSX.Element {
  return (
    <div
      className={`flex items-center gap-2 transition-all duration-200 ${
        open
          ? 'opacity-100 translate-y-0 scale-100'
          : 'opacity-0 translate-y-4 scale-80 pointer-events-none'
      }`}
      style={{ transitionDelay: open ? (delay ?? '0ms') : '0ms' }}
    >
      <span className={`text-sm font-medium text-white transition-opacity duration-200 ${
        open ? 'opacity-100' : 'opacity-0'
      }`}>
        {label}
      </span>
      <button
        onClick={onClick}
        className="h-10 w-10 rounded-full bg-white text-gray-700 shadow-md flex items-center justify-center hover:bg-gray-50"
        aria-label={ariaLabel}
      >
        {icon}
      </button>
    </div>
  );
}

const ShareIcon = ({ className }: { className: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
  </svg>
);

export function SpeedDialFAB({ visible, onShare, onCopy }: SpeedDialFABProps): React.JSX.Element {
  const [fabOpen, setFabOpen] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset state when FAB becomes hidden
  useEffect(() => {
    if (!visible) {
      setFabOpen(false);
      setCopySuccess(false);
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
        copyTimerRef.current = null;
      }
    }
  }, [visible]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const handleShare = () => {
    setFabOpen(false);
    onShare();
  };

  const handleCopy = () => {
    setFabOpen(false);
    onCopy();
    setCopySuccess(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => {
      setCopySuccess(false);
      copyTimerRef.current = null;
    }, COPY_SUCCESS_DURATION_MS);
  };

  const copyIcon = copySuccess ? (
    <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  ) : (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
    </svg>
  );

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black transition-opacity duration-150 ${
          fabOpen ? 'opacity-40 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        style={{ zIndex: 40 }}
        onClick={() => setFabOpen(false)}
        aria-hidden="true"
      />

      {/* Speed dial container */}
      <div className="fixed bottom-3 right-0" style={{ zIndex: 50 }}>
        {/* Speed dial items */}
        <div className="flex flex-col items-end gap-3 mb-3">
          <SpeedDialItem
            label="Copy"
            ariaLabel="Copy summary"
            open={fabOpen}
            onClick={handleCopy}
            delay="50ms"
            icon={copyIcon}
          />
          <SpeedDialItem
            label="Share"
            ariaLabel="Share summary"
            open={fabOpen}
            onClick={handleShare}
            icon={<ShareIcon className="h-5 w-5" />}
          />
        </div>

        {/* Main FAB */}
        <button
          onClick={() => setFabOpen((prev) => !prev)}
          className={`h-14 w-14 rounded-full bg-blue-600 text-white shadow-lg flex items-center justify-center transition-transform duration-200 ease-out ${
            visible ? 'scale-100' : 'scale-0'
          }`}
          aria-label={fabOpen ? 'Close share menu' : 'Share summary'}
        >
          {fabOpen ? (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <ShareIcon className="h-6 w-6" />
          )}
        </button>
      </div>
    </>
  );
}
