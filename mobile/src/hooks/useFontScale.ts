import { useState, useEffect, useCallback } from 'react';
import { loadFontScale, saveFontScale } from '../services/fontScaleStorage';

function applyScale(scale: number): void {
  document.documentElement.style.fontSize = `${scale}%`;
}

export function useFontScale(): { fontScale: number; setFontScale: (scale: number) => void } {
  const [fontScale, setFontScaleState] = useState(100);

  useEffect(() => {
    void loadFontScale().then((scale) => {
      setFontScaleState(scale);
      applyScale(scale);
    });
  }, []);

  const setFontScale = useCallback((scale: number) => {
    setFontScaleState(scale);
    applyScale(scale);
    void saveFontScale(scale);
  }, []);

  return { fontScale, setFontScale };
}
