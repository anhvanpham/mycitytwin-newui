import type { SolarSystemHover } from './RoofPanelMarker';
import { useEffect, useMemo, useRef } from 'react';
import { Color, Float32BufferAttribute, type Group, type Mesh } from 'three';
import type { CityModel, Development } from '../data/model';
import { groundElevationOf, mergeMassingsOwned } from './massing';
import { buildingCentres, buildingsUnder } from '../data/replaces';
import { CBDClip } from './CBDClip';
import { StreetDetails } from './StreetDetails';
import { cbdGroundPlacement } from './cbdBoundary';
import { useOpenBasemapTexture } from './useOpenBasemap';
import type { StreetDetailsDoc, StreetLayers } from '../data/streetDetails';
import { groundPlacement } from './basemap';
import { useBasemapTexture } from './useBasemap';
import { useMapboxConfig } from '../data/mapboxConfig';
import { Roads } from './Roads';
import { Ground } from './Ground';
import { HazeVeil } from './HazeVeil';
import { DevelopmentMassings } from './DevelopmentMassings';
import { ReceptorMarker } from './ReceptorMarker';
import { WindowMarker } from './WindowMarker';
import { OpenSpace } from './OpenSpace';
import { HighlightedBuilding } from './HighlightedBuilding';
import { BuildingPicker } from './BuildingPicker';

import type { RoofPanel, PlacedPanel } from "./solarPanel";
import { RoofPanelMarker } from "./RoofPanelMarker";
interface CityMassingProps {
  solarHover?: SolarSystemHover;
  solarPanels?: PlacedPanel[];
  onStopRoofPlacement?: () => void;
  onPickRoof?: (roof: RoofPanel) => void;
  streetMap?: boolean;
  sunAltitudeDeg?: number;
  streetDetails?: StreetDetailsDoc | null;
  streetLayers?: StreetLayers;
  model: CityModel;
  /** The development being examined. Its parts render as the proposal. */
  focus: Development | null;
  /** False shows the city as built; true adds the approved massing. */
  showProposed: boolean;
  /** True everywhere except the sunlight screen, which wants one shadow. */
  showAllProposals: boolean;
  onSelectDevelopment: (development: Development) => void;
  /**
   * A double click on a building standing today, by its id. Undefined where
   * buildings are not to be opened — see BuildingPicker.
   */
  onSelectBuilding?: (buildingId: string) => void;
  /** The spot being measured, if one has been picked. */
  receptor: [number, number] | null;
  /**
   * The window being measured, if the reader has chosen one. Drawn here
   * because it belongs to the city rather than to the ground -- it stands on
   * a facade, and CityMassing is what draws facades.
   */
  windowAt?: { en: [number, number]; ahdM: number; facingDeg: number } | null;
  onPickReceptor?: (point: [number, number]) => void;
  /** A building found by searching, drawn in pink. */
  highlightedBuildingId: string | null;
  /**
   * Whether that building is standing.
   *
   * It is already lifted out of the welded city (see below), so switching
   * this off simply does not draw it — and the city is then genuinely
   * without it, shadow included. That is the before/after for an existing
   * building, and it costs nothing extra because the removal was already
   * happening for the highlight.
   */
  showHighlighted: boolean;
  /** False in focus mode: nothing in the scene changes state. */
  interactive: boolean;
  /** What the ground dissolves into far away — see sky.ts. */
  haze: string;
  /** Standing in the street rather than looking down at it. */
  walking: boolean;
}

/**
 * The built city, plus the proposal when it is switched on.
 *
 * Three merged meshes, split by what the colour has to say: built form, form
 * we could not reconcile, and the proposal. The palette is the one from the
 * design — a near-white city so the mint proposal is the only thing that
 * carries colour, and the eye goes straight to what changed.
 */
export function CityMassing({
  model,
  streetMap = false,
  sunAltitudeDeg = 45,
  streetDetails = null,
  streetLayers = {},
  focus,
  showProposed,
  showAllProposals,
  onSelectDevelopment,
  onSelectBuilding,
  solarHover,
  solarPanels,
  onStopRoofPlacement,
  onPickRoof,
  receptor,
  windowAt,
  onPickReceptor,
  interactive,
  highlightedBuildingId,
  showHighlighted,
  haze,
  walking,
}: CityMassingProps) {
  const groundAhdM = useMemo(
    () => groundElevationOf(model.buildings),
    [model.buildings],
  );

  /*
    * Keyed on the numbers, not on the object. The model is rebuilt when the
    * live API answers, and its extent is then a NEW object holding the SAME
    * four values — which changed the placement by identity, restarted the
    * image request, and took the map off the screen while an image it already
    * had was fetched again.
    */
  const { minE, minN, maxE, maxN } = model.extent;
  const { placement } = useMemo(
    () => groundPlacement({ minE, minN, maxE, maxN }),
    [minE, minN, maxE, maxN],
  );
  /*
   * Where the distance haze runs. It has to finish at or beyond the ground's
   * own rim, or a ring of un-hazed ground shows past it against the sky.
   */
  const hazeExtent = useMemo(() => {
    const { centreE, centreN, span, size } = groundPlacement(model.extent);
    return { centreE, centreN, innerM: span * 0.62, outerM: size * 0.5 };
  }, [model.extent]);

  const mapbox = useMapboxConfig();
  const originalBasemap = useBasemapTexture(placement, streetMap ? null : mapbox);
  const openPlacement=useMemo(()=>cbdGroundPlacement(),[]);
  const openBasemap=useOpenBasemapTexture(openPlacement.placement,streetMap);
  const basemap=streetMap?openBasemap:originalBasemap;

  /** Every building centre, once, so the sites can be looked up cheaply. */
  const centres = useMemo(() => buildingCentres(model.buildings), [model.buildings]);

  /*
   * The buildings a visible proposal is built over.
   *
   * Only the proposals actually on screen: the sunlight screen draws one, and
   * taking down the city under the other 48 would empty streets that nothing
   * on screen explains. With proposals switched off entirely the set is
   * empty, which is what makes the toggle a genuine before and after rather
   * than "the city" against "the city plus a tower standing inside it".
   */
  const replaced = useMemo(() => {
    if (!showProposed) return new Set<string>();
    const shown = showAllProposals ? model.developments : focus ? [focus] : [];
    return new Set(
      shown.flatMap((development) =>
        buildingsUnder(
          development.parts.map((part) => part.footprint).flat(),
          centres,
        ),
      ),
    );
  }, [showProposed, showAllProposals, model.developments, focus, centres]);

  const { built, unresolved } = useMemo(() => {
    /*
     * Two reasons a building is left out of the welded city, and they are the
     * same reason: something else is standing in its place.
     *
     * The highlighted one is drawn separately below — inside the merged
     * object it would show through the pink one. A replaced one is not drawn
     * at all, because the proposal above it is what the plan puts there.
     */
    const inCity = (b: (typeof model.buildings)[number]) =>
      b.parentId !== highlightedBuildingId && !replaced.has(b.parentId);
    const ok = model.buildings.filter((b) => b.readyFor3d && inCity(b));
    const bad = model.buildings.filter((b) => !b.readyFor3d && inCity(b));
    const city = mergeMassingsOwned(ok, groundAhdM);
    if (streetMap && city) {
      // One consistent pearl tint per building, including all of its roof planes.
      // The city stays welded into one mesh; ownership and shadow geometry stay intact.
      const palette = ['#e9e0f9', '#e4eefb', '#f8ebe7', '#efebf9'].map(hex=>new Color(hex));
      const colours = new Float32Array(city.geometry.getAttribute('position').count * 3);
      let start = 0;
      city.owners.forEach((owner,index)=>{
        const id = (owner as typeof ok[number]).parentId;
        let hash = 0; for(const char of id) hash=(Math.imul(hash,31)+char.charCodeAt(0))|0;
        const tint = palette[(hash>>>0)%palette.length],end=city.ends[index];
        for(let vertex=start;vertex<end;vertex++)tint.toArray(colours,vertex*3);
        start=end;
      });
      city.geometry.setAttribute('color',new Float32BufferAttribute(colours,3));
    }
    return { built: city, unresolved: mergeMassingsOwned(bad, groundAhdM) };
  }, [model.buildings, groundAhdM, highlightedBuildingId, replaced, streetMap]);

  /** What BuildingPicker casts its ray at, and what can stand in front. */
  const builtMesh = useRef<Mesh>(null);
  const unresolvedMesh = useRef<Mesh>(null);
  const highlightGroup = useRef<Group>(null);
  const panelMarkers = useRef<Group>(null);
  const projectsGroup = useRef<Group>(null);

  /*
   * The merged city is rebuilt whenever a proposal is shown or hidden, and
   * react-three-fiber replaces the `geometry` property without disposing the
   * previous one. This mesh is the whole ready-built city — about 23 MiB of
   * vertex attributes — so toggling the layer a few times used to cost that
   * much GPU memory each time, with nothing left holding it.
   */
  useEffect(
    () => () => {
      built?.geometry.dispose();
      unresolved?.geometry.dispose();
    },
    [built, unresolved],
  );

  return (
    <CBDClip enabled={streetMap} colour={haze}>
      {/* The blocks between the streets, dissolving where the data ends. */}
      <Ground
        model={model}
        groundAhdM={groundAhdM}
        basemap={basemap}
        cbd={streetMap}
        walking={walking}
        onPick={onPickReceptor}
      />

      {/*
        Everything above is the modelled city; the haze goes over all of it,
        so a park or a road at the far edge dissolves with the ground rather
        than staying sharp inside a fading surround.
      */}
      {!basemap && <OpenSpace groundAhdM={groundAhdM} />}
      {streetMap && <StreetDetails doc={streetDetails} layers={streetLayers} ground={groundAhdM} sunAltitudeDeg={sunAltitudeDeg}/>}

      {/*
        The inferred carriageways stand down once a real map is under the
        city, because the map draws the same streets from surveyed data and
        these were reasoned out from 133 addresses. Measured against the map
        they are visibly out of place, worst beyond the building data, where
        there was nothing to subtract and the whole 30-metre band survives as
        guesswork.

        Not deleted, because they are still the right answer when there is no
        map: a token that has expired, a browser with no network, or a frozen
        release long after this term. The fallback and the layer it falls back
        to are the same decision, which is why the texture is loaded up here.
      */}
      {!basemap && <Roads groundAhdM={groundAhdM} />}

      {/*
        Not when the plan demolishes it. The merged city already drops a
        replaced building; drawing it again here as the search highlight put
        it straight back inside the proposal, both solids casting shadow.
      */}
      {showHighlighted && !(highlightedBuildingId && replaced.has(highlightedBuildingId)) && (
        <group ref={highlightGroup}>
          <HighlightedBuilding
            pastel={streetMap}
            buildings={model.buildings}
            buildingId={highlightedBuildingId}
            groundAhdM={groundAhdM}
          />
        </group>
      )}

      {receptor && <ReceptorMarker point={receptor} groundAhdM={groundAhdM} />}
      {windowAt && (
        <WindowMarker en={windowAt.en} ahdM={windowAt.ahdM} facingDeg={windowAt.facingDeg} />
      )}

      {built && (
        <mesh ref={builtMesh} castShadow receiveShadow geometry={built.geometry}>
          {streetMap ? <meshPhysicalMaterial key="crystal-city" vertexColors color="#ffffff" roughness={0.48} metalness={0.035} clearcoat={0.4} clearcoatRoughness={0.3} emissive="#d8d8f2" emissiveIntensity={sunAltitudeDeg>0?0.055:0.008}/> : <meshStandardMaterial color="#eeedf0" roughness={0.82} metalness={0} />}
        </mesh>
      )}

      {/*
        Rows whose two height columns disagree. Shown in a muted tone rather
        than removed: a building taken out of the scene casts no shadow, and
        an absent shadow reads to a resident as sunlight.
      */}
      {unresolved && (
        <mesh ref={unresolvedMesh} castShadow receiveShadow geometry={unresolved.geometry}>
          <meshStandardMaterial color={streetMap?'#e8e1f0':'#d9d5cf'} roughness={streetMap?0.65:0.95} metalness={0} />
        </mesh>
      )}

      {/*
        Not while walking.

        It is a horizontal sheet a metre above the ground, and the eye is
        only 1.7 m up — so from a footpath the line of sight runs ALONG it
        and out through its opaque outer region, washing everything below the
        horizon to the haze colour. From above, where it hides the edge of
        the modelled ground, it works; at eye height it is a fog bank lying
        on the city.

        Nothing is lost by dropping it here. The disc's rim is only visible
        from height, and past it the sky dome's lower hemisphere is already
        painted the same haze.
      */}
      {!walking && !streetMap && (
      <HazeVeil
        centreE={hazeExtent.centreE}
        centreN={hazeExtent.centreN}
        groundAhdM={groundAhdM}
        innerM={hazeExtent.innerM}
        outerM={hazeExtent.outerM}
        colour={haze}
      />
      )}

      {showProposed && (
        <group ref={projectsGroup}>
          <DevelopmentMassings
            pastel={streetMap}
            developments={model.developments}
            focus={focus}
            groundAhdM={groundAhdM}
            showAll={showAllProposals}
            interactive={interactive}
            onSelect={onSelectDevelopment}
          />
        </group>
      )}

      <group ref={panelMarkers}>{solarPanels?.filter(panel => !replaced.has(panel.roof.buildingId) && (showHighlighted || panel.roof.buildingId !== highlightedBuildingId) && (panel.roof.kind !== "development" || showProposed)).map(panel => <RoofPanelMarker key={panel.id} {...panel} solarHover={solarHover}/> )}</group>
      <BuildingPicker
        city={[
          { mesh: builtMesh, owned: built },
          { mesh: unresolvedMesh, owned: unresolved },
        ]}
        panelMarkers={panelMarkers}
        blockers={projectsGroup}
        highlighted={{ object: highlightGroup, id: highlightedBuildingId }}
        onStopRoofPlacement={onStopRoofPlacement}
        onPickRoof={interactive && !walking ? onPickRoof : undefined}
        onSelect={interactive && !walking && !onPickRoof ? onSelectBuilding : undefined}
      />
    </CBDClip>
  );
}
