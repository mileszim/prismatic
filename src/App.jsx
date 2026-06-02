// State container: owns the three slider values, derives the optics params, and
// composes the viewfinder with its control panel.

import { useState } from 'react';
import Viewfinder from './components/Viewfinder.jsx';
import ControlPanel from './components/ControlPanel.jsx';
import { STOPS, focusFromSlider, sliderFromFocus, focusLabel } from './constants.js';

export default function App() {
  const [apIdx, setApIdx] = useState(2); // ƒ/2.8
  const [focusSlider, setFocusSlider] = useState(430); // ~10 m
  const [isoIdx, setIsoIdx] = useState(2); // ISO 400

  const fnum = STOPS[apIdx];
  const focus = focusFromSlider(focusSlider);

  return (
    <div className="machine">
      <Viewfinder
        fnum={fnum}
        focus={focus}
        isoIdx={isoIdx}
        onFocusDistance={(dist) => setFocusSlider(sliderFromFocus(dist))}
      />
      <ControlPanel
        apIdx={apIdx}
        setApIdx={setApIdx}
        focusSlider={focusSlider}
        setFocusSlider={setFocusSlider}
        focusDisplay={focusLabel(focus)}
        isoIdx={isoIdx}
        setIsoIdx={setIsoIdx}
      />
      <div className="credit">drag to look · click to focus</div>
    </div>
  );
}
