// State container: owns the four control values, derives the optics params,
// composes the viewfinder + panel, and manages the camera roll.

import { useEffect, useRef, useState } from 'react';
import Viewfinder from './components/Viewfinder.jsx';
import ControlPanel from './components/ControlPanel.jsx';
import CameraRoll from './components/CameraRoll.jsx';
import Lightbox from './components/Lightbox.jsx';
import {
  STOPS, ISOS, SHUTTERS,
  focusFromSlider, sliderFromFocus, focusLabel,
  shutterLabel, shutterSeconds, exposureStops,
} from './constants.js';
import { addPhoto, getAllPhotos, clearPhotos } from './photoStore.js';

export default function App() {
  const [apIdx, setApIdx] = useState(2); // ƒ/2.8
  const [focusSlider, setFocusSlider] = useState(430); // ~10 m
  const [isoIdx, setIsoIdx] = useState(2); // ISO 400
  const [shutterIdx, setShutterIdx] = useState(3); // 1/125 — neutral exposure

  const [photos, setPhotos] = useState([]);
  const [selected, setSelected] = useState(null);
  const viewfinderRef = useRef(null);

  const fnum = STOPS[apIdx];
  const focus = focusFromSlider(focusSlider);
  const shutterSec = shutterSeconds(shutterIdx);
  const expo = exposureStops(fnum, shutterIdx, isoIdx);

  // Load any saved frames on mount (newest first).
  useEffect(() => {
    let alive = true;
    getAllPhotos().then((list) => { if (alive) setPhotos(list.reverse()); });
    return () => { alive = false; };
  }, []);

  // Fires for both the shutter button and the Spacebar release.
  const handleCapture = async (dataURL) => {
    const meta = {
      fnum: STOPS[apIdx],
      shutter: shutterLabel(shutterIdx),
      iso: ISOS[isoIdx],
      focus: focusLabel(focus),
      ts: Date.now(),
    };
    const id = await addPhoto({ dataURL, meta });
    setPhotos((prev) => [{ id, dataURL, meta }, ...prev]);
  };

  const handleClear = async () => {
    await clearPhotos();
    setPhotos([]);
    setSelected(null);
  };

  const shoot = () => viewfinderRef.current?.capture();

  return (
    <>
      <div className="machine">
        <Viewfinder
          ref={viewfinderRef}
          fnum={fnum}
          focus={focus}
          isoIdx={isoIdx}
          shutterSec={shutterSec}
          expo={expo}
          onFocusDistance={(dist) => setFocusSlider(sliderFromFocus(dist))}
          onCapture={handleCapture}
        />
        <ControlPanel
          apIdx={apIdx}
          setApIdx={setApIdx}
          focusSlider={focusSlider}
          setFocusSlider={setFocusSlider}
          focusDisplay={focusLabel(focus)}
          isoIdx={isoIdx}
          setIsoIdx={setIsoIdx}
          shutterIdx={shutterIdx}
          setShutterIdx={setShutterIdx}
        />
        <div className="shutter-bar">
          <button className="shutter-btn" onClick={shoot} aria-label="Take photo">
            <span />
          </button>
        </div>
        <div className="credit">w/s move · a/d turn · drag to look · click to focus · space to shoot</div>
        <CameraRoll photos={photos} onSelect={setSelected} onClear={handleClear} />
      </div>
      {selected && <Lightbox photo={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
