// React bridge to the imperative rendering engine. Owns the <canvas>, creates
// the engine once on mount, and pushes optics params in as props change.

import { useEffect, useRef } from 'react';
import { createViewfinder } from '../engine/viewfinder.js';

export default function Viewfinder({ fnum, focus, isoIdx, onFocusDistance, width = 920, height = 600 }) {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);

  // Keep the latest focus callback in a ref so the engine (created once) always
  // calls the current handler without needing to be torn down and rebuilt.
  const onFocusRef = useRef(onFocusDistance);
  useEffect(() => { onFocusRef.current = onFocusDistance; });

  useEffect(() => {
    const engine = createViewfinder(canvasRef.current, {
      onFocus: (dist) => onFocusRef.current?.(dist),
    });
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setParams({ fnum, focus, isoIdx });
  }, [fnum, focus, isoIdx]);

  return (
    <div className="scope">
      <canvas ref={canvasRef} width={width} height={height} />
    </div>
  );
}
