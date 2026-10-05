import { MAX_PANELS, type PlacedPanel, type PanelSettings } from '../scene/solarPanel';
import type { SolarSystemResult } from './useSolarSystem';
import '../styles/solar-panel.css';

export function SolarPanelSimulator({ panels, setId, settings, armed, notice, onAdd, onNewSet, onCancel, onUndo, onSettings, onClose }: {
 panels: PlacedPanel[]; setId: number; settings: PanelSettings; armed: boolean; notice: string;
 onAdd: () => void; onNewSet: () => void; onCancel: () => void; onUndo: () => void; onSettings: (settings: PanelSettings) => void; onClose: () => void;
}) {
 const setCount = panels.filter(p => p.setId === setId).length;
 return <aside className={`solar-panel-sim sheet--sun${armed ? " solar-panel-sim--placing" : ""}`} aria-label="Rooftop solar panel simulation">
  <div className="solar-panel-sim__heading"><strong>Rooftop solar</strong><button onClick={onClose} aria-label="Close rooftop solar">×</button></div>
  <p className="solar-panel-sim__subtitle">{panels.length}/{MAX_PANELS} panels · Estimated clear-sky generation</p>
  {notice && <p role="status" className="solar-panel-sim__notice">{notice}</p>}
  {armed ? <>
   <p>Left-click or tap a flat roof to add panels to set {setId}. Right-click to stop. Drag or pinch to explore.</p>
   <button className="solar-panel-sim__place" onClick={onCancel}>Done placing</button>
   <button className="solar-panel-sim__undo" disabled={!setCount} onClick={onUndo}>Undo last panel</button>
  </> : <>
   <h2>Set {setId} <small>· {setCount} panels</small></h2>
   <p className="solar-panel-sim__subtitle">These settings apply to every panel in this set.</p>
   <label>Panel rating <input aria-label="Panel rating" type="number" min="100" max="1000" step="10" value={settings.watts} onChange={e => onSettings({...settings, watts: Math.min(1000,Math.max(100,Number(e.target.value)||100))})}/> W</label>
   <label>Tilt <span>{settings.tilt}°</span><input aria-label="Panel tilt" type="range" min="0" max="60" value={settings.tilt} onChange={e => onSettings({...settings, tilt: Number(e.target.value)})}/></label>
   <label>Direction <span>{settings.azimuth}° · 0° North</span><input aria-label="Panel direction" type="range" min="0" max="359" value={settings.azimuth} onChange={e => onSettings({...settings, azimuth: Number(e.target.value)})}/></label>
   <button className="solar-panel-sim__place" disabled={panels.length >= MAX_PANELS} onClick={onAdd}>{panels.length >= MAX_PANELS ? '20-panel limit reached' : setCount ? 'Add panels to this set' : 'Place panels'}</button>
   {setCount > 0 && <div className="solar-panel-sim__actions"><button disabled={panels.length >= MAX_PANELS} onClick={onNewSet}>Add another set</button><button onClick={onUndo}>Undo last panel</button></div>}
   <details><summary>Estimate assumptions</summary><p> Maximum 20 panels is a usability limit, not roof capacity. Centres must be 2.2 m apart. No panel-to-panel shading or electrical string effects. Assumed 25°C air and 14% system losses. Simplified flat roofs, no equipment or roof-edge fit check, no measured weather. 10-minute samples; illustrative panel dimensions.</p></details>
  </>}
 </aside>;
}

export function SolarSystemInfo({result}: {result: SolarSystemResult}) {
 return <><strong>Solar system · {result.count} panels</strong>
  {result.available ? <><p><b>{result.sunHours.toFixed(1)} h</b> average direct sun per panel</p><p><b>{result.kwh.toFixed(2)} kWh</b> estimated electricity for this day</p><p>{result.shadeLoss.toFixed(0)}% energy lost to building shade</p></> : <p>No panels available in this map view.</p>}
  {result.available < result.count && <small>{result.available}/{result.count} panels have a roof in this view.</small>}
  <small>Clear-sky estimate · current day and map view</small>
 </>;
}
export function SolarGenerationSummary({result, onEdit}: {result: SolarSystemResult; onEdit: () => void}) {
 return <section className="solar-generation" aria-label="Solar system performance"><SolarSystemInfo result={result}/>
  <button className="button button--block solar-overview-button" onClick={onEdit}>Edit / add solar panels</button>
 </section>;
}
