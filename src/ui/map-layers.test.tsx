import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MapLayers } from './screens';
const html=(status:'loading'|'ready'|'error'='ready', mode:'street'|'model'|'integrated'='integrated')=>renderToStaticMarkup(<MapLayers layers={{developments:true,shadows:true}} onChange={()=>undefined} onClose={()=>undefined} streetDataStatus={status} mode={mode}/>);
describe('map layer controls',()=>{
  it('offers the appropriate switches for each map view and explains what the new visuals mean',()=>{
    const s=html();expect(s.match(/type="checkbox"/g)).toHaveLength(6);
    for(const label of ['Trees','Streetlights','Road markings','Landmarks'])expect(s).toContain(label);
    expect(s).toContain('same sunlight map');
    expect(html('ready','model').match(/type="checkbox"/g)).toHaveLength(2);
    expect(html('ready','model')).toContain('Sunlight &amp; shadows');
    expect(s).toContain('Sunlight &amp; shadows');
    expect(s.match(/checked=""/g)).toHaveLength(6);
  });
  it('reports loading and failure without pretending street data is present',()=>{
    expect(html('loading')).toContain('Loading trees, lamps and road details');
    expect(html('error')).toContain('Street details could not load');
    expect(html()).not.toContain('could not load');
  });
});
