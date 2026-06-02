// React bridge to the imperative rendering engine. Owns the <canvas>, creates
// the engine once on mount, pushes optics params in as props change, and exposes
// an imperative capture() so the shutter button can grab a frame.

import { useEffect, useImperativeHandle, useRef, forwardRef } from 'react';
import { createViewfinder } from '../engine/viewfinder.js';

const Viewfinder = forwardRef(function Viewfinder(
  { fnum, focus, isoIdx, shutterSec, expo, onFocusDistance, onCapture, width = 920, height = 600 },
  ref,
) {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);

  // Keep the latest callbacks in refs so the engine (created once) always calls
  // the current handlers without being torn down and rebuilt.
  const onFocusRef = useRef(onFocusDistance);
  const onCaptureRef = useRef(onCapture);
  useEffect(() => { onFocusRef.current = onFocusDistance; });
  useEffect(() => { onCaptureRef.current = onCapture; });

  useEffect(() => {
    const engine = createViewfinder(canvasRef.current, {
      onFocus: (dist) => onFocusRef.current?.(dist),
      onCapture: (dataURL) => onCaptureRef.current?.(dataURL),
    });
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setParams({ fnum, focus, isoIdx, shutterSec, expo });
  }, [fnum, focus, isoIdx, shutterSec, expo]);

  useImperativeHandle(ref, () => ({ capture: () => engineRef.current?.capture() }), []);

  return (
    <div className="scope">
      <canvas ref={canvasRef} width={width} height={height} />
    </div>
  );
});

export default Viewfinder;
