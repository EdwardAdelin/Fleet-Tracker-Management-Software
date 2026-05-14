import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

export default function DispatcherTools() {
  const [distanceKm, setDistanceKm] = useState(0);
  const [avgSpeed, setAvgSpeed] = useState(50);
  const [fuelConsumption, setFuelConsumption] = useState(8);
  const [fuelPrice, setFuelPrice] = useState(1.7);

  const [currency, setCurrency] = useState<'EUR' | 'RON' | 'USD' | 'CUSTOM'>('EUR');
  const [customCurrency, setCustomCurrency] = useState('€');

  const [baseCost, setBaseCost] = useState(0);
  const [baseCostTouched, setBaseCostTouched] = useState(false);
  const [extraCosts, setExtraCosts] = useState(0);
  const [profitMargin, setProfitMargin] = useState(15);
  const [pallets, setPallets] = useState(0);
  const [spaceMetric, setSpaceMetric] = useState<'sqm' | 'sqft' | 'cbm' | 'cft'>('sqm');
  const [stackHeight, setStackHeight] = useState(1); // meters

  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [destination, setDestination] = useState<{ lat: number; lng: number } | null>(null);
  const [routeCoords, setRouteCoords] = useState<Array<[number, number]>>([]);
  const [originName, setOriginName] = useState('');
  const [destinationName, setDestinationName] = useState('');

  function decodePolyline(encoded: string): Array<[number, number]> {
    const coordinates: Array<[number, number]> = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
      let b;
      let shift = 0;
      let result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const deltaLat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lat += deltaLat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const deltaLng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lng += deltaLng;

      coordinates.push([lat / 1e5, lng / 1e5]);
    }

    return coordinates;
  }

  async function geocode(query: string) {
    const encoded = encodeURIComponent(query);
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&limit=1`;
    const res = await fetch(url, {
      headers: {
        'Accept-Language': 'en',
      },
    });
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    return {
      lat: Number(data[0].lat),
      lng: Number(data[0].lon),
    };
  }

  const travelTime = useMemo(() => {
    if (distanceKm <= 0 || avgSpeed <= 0) return { hours: 0, minutes: 0 };
    const hours = distanceKm / avgSpeed;
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    return { hours: wholeHours, minutes };
  }, [distanceKm, avgSpeed]);

  const totalFuelNeeded = useMemo(() => {
    if (distanceKm <= 0 || fuelConsumption <= 0) return 0;
    return (distanceKm * fuelConsumption) / 100;
  }, [distanceKm, fuelConsumption]);

  const totalFuelCost = useMemo(() => {
    if (totalFuelNeeded <= 0 || fuelPrice <= 0) return 0;
    return totalFuelNeeded * fuelPrice;
  }, [totalFuelNeeded, fuelPrice]);

  const currencySymbol = useMemo(() => {
    switch (currency) {
      case 'EUR':
        return '€';
      case 'RON':
        return 'lei';
      case 'USD':
        return '$';
      case 'CUSTOM':
        return customCurrency || '';
      default:
        return '';
    }
  }, [currency, customCurrency]);

  useEffect(() => {
    if (!baseCostTouched) {
      setBaseCost(Number(totalFuelCost.toFixed(2)));
    }
  }, [totalFuelCost, baseCostTouched]);

  useEffect(() => {
    if (!origin || !destination) return;

    const controller = new AbortController();
    const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=polyline`;

    fetch(url, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        const meters = data?.routes?.[0]?.distance;
        const geometry = data?.routes?.[0]?.geometry;

        if (typeof meters === 'number') {
          setDistanceKm(Number((meters / 1000).toFixed(2)));
        }

        if (typeof geometry === 'string') {
          setRouteCoords(decodePolyline(geometry));
        }
      })
      .catch((err) => {
        if ((err as any)?.name !== 'AbortError') {
          console.error(err);
        }
      });

    return () => controller.abort();
  }, [origin, destination]);

  const finalQuote = useMemo(() => {
    const base = Math.max(0, baseCost);
    const extras = Math.max(0, extraCosts);
    const margin = Math.max(0, profitMargin);
    return (base + extras) * (1 + margin / 100);
  }, [baseCost, extraCosts, profitMargin]);

  const floorSpace = useMemo(() => pallets * 0.96, [pallets]);

  const { displaySpace, displayUnit } = useMemo(() => {
    if (spaceMetric === 'sqm') {
      return { displaySpace: floorSpace, displayUnit: 'm²' };
    }

    if (spaceMetric === 'sqft') {
      return { displaySpace: floorSpace * 10.7639, displayUnit: 'ft²' };
    }

    const volumeM3 = floorSpace * stackHeight;
    if (spaceMetric === 'cbm') {
      return { displaySpace: volumeM3, displayUnit: 'm³' };
    }

    // cft
    return { displaySpace: volumeM3 * 35.3147, displayUnit: 'ft³' };
  }, [floorSpace, spaceMetric, stackHeight]);

  const suggestedVehicle = useMemo(() => {
    if (pallets <= 4) return 'VAN';
    return 'TRUCK';
  }, [pallets]);

  function MapClickHandler() {
    useMapEvents({
      click(e) {
        const clicked = { lat: e.latlng.lat, lng: e.latlng.lng };

        if (!origin) {
          setOrigin(clicked);
          return;
        }

        if (!destination) {
          setDestination(clicked);
          return;
        }

        setOrigin(clicked);
        setDestination(null);
      },
    });

    return null;
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Dispatcher Toolkit</h1>
        <p className="mt-1 text-sm text-slate-600">
          Calculate route costs, build client quotes, and plan cargo loading.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-3">
        <section className="md:col-span-3 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Route planner</h2>
              <p className="mt-2 text-sm text-slate-600">
                Click the map or type coordinates to set origin and destination.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  setOrigin(null);
                  setDestination(null);
                }}
                className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-200"
              >
                Clear map
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-slate-700">Origin</p>
                <div className="mt-2 grid gap-2 md:grid-cols-3">
                  <input
                    type="text"
                    value={originName}
                    onChange={(event) => setOriginName(event.target.value)}
                    placeholder="City name"
                    className="col-span-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      const coords = await geocode(originName);
                      if (!coords) {
                        window.alert('Location not found. Try a different name.');
                        return;
                      }
                      setOrigin(coords);
                    }}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
                  >
                    Find
                  </button>

                  <input
                    type="number"
                    value={origin?.lat ?? ''}
                    onChange={(event) =>
                      setOrigin((prev) => ({
                        lat: Number(event.target.value),
                        lng: prev?.lng ?? 0,
                      }))
                    }
                    placeholder="Latitude"
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                  <input
                    type="number"
                    value={origin?.lng ?? ''}
                    onChange={(event) =>
                      setOrigin((prev) => ({
                        lat: prev?.lat ?? 0,
                        lng: Number(event.target.value),
                      }))
                    }
                    placeholder="Longitude"
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-slate-700">Destination</p>
                <div className="mt-2 grid gap-2 md:grid-cols-3">
                  <input
                    type="text"
                    value={destinationName}
                    onChange={(event) => setDestinationName(event.target.value)}
                    placeholder="City name"
                    className="col-span-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      const coords = await geocode(destinationName);
                      if (!coords) {
                        window.alert('Location not found. Try a different name.');
                        return;
                      }
                      setDestination(coords);
                    }}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
                  >
                    Find
                  </button>

                  <input
                    type="number"
                    value={destination?.lat ?? ''}
                    onChange={(event) =>
                      setDestination((prev) => ({
                        lat: Number(event.target.value),
                        lng: prev?.lng ?? 0,
                      }))
                    }
                    placeholder="Latitude"
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                  <input
                    type="number"
                    value={destination?.lng ?? ''}
                    onChange={(event) =>
                      setDestination((prev) => ({
                        lat: prev?.lat ?? 0,
                        lng: Number(event.target.value),
                      }))
                    }
                    placeholder="Longitude"
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                </div>
              </div>
            </div>

            <div className="relative h-96 w-full overflow-hidden rounded-xl border border-slate-200">
              <MapContainer
                center={[45.9, 25.0]}
                zoom={6}
                scrollWheelZoom
                className="h-full w-full"
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <MapClickHandler />
                {origin && (
                  <Marker position={[origin.lat, origin.lng]}>
                    <Popup>Origin</Popup>
                  </Marker>
                )}
                {destination && (
                  <Marker position={[destination.lat, destination.lng]}>
                    <Popup>Destination</Popup>
                  </Marker>
                )}
                {routeCoords.length > 0 && <Polyline positions={routeCoords} color="#2563eb" weight={4} />}
              </MapContainer>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center pb-2">
                <div className="rounded-full bg-white/80 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm">
                  Click map to set origin/destination
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Route & Cost Calculator</h2>
          <p className="mt-2 text-sm text-slate-600">
            Estimate travel time and fuel costs based on route parameters.
          </p>

          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">Distance (km)</span>
              <input
                type="number"
                value={distanceKm}
                onChange={(event) => setDistanceKm(Number(event.target.value))}
                min={0}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                placeholder="e.g. 120"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Average speed (km/h)</span>
              <input
                type="number"
                value={avgSpeed}
                onChange={(event) => setAvgSpeed(Number(event.target.value))}
                min={1}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                placeholder="e.g. 80"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Fuel consumption (L/100km)</span>
              <input
                type="number"
                value={fuelConsumption}
                onChange={(event) => setFuelConsumption(Number(event.target.value))}
                min={0}
                step={0.1}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                placeholder="e.g. 8.5"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Currency</span>
              <div className="mt-1 flex flex-col gap-2 md:flex-row md:items-center">
                <select
                  value={currency}
                  onChange={(event) => setCurrency(event.target.value as typeof currency)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                >
                  <option value="EUR">EUR (Euro)</option>
                  <option value="RON">RON (Leu)</option>
                  <option value="USD">USD (Dollar)</option>
                  <option value="CUSTOM">Custom</option>
                </select>

                {currency === 'CUSTOM' && (
                  <input
                    type="text"
                    value={customCurrency}
                    onChange={(event) => setCustomCurrency(event.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    placeholder="Custom currency symbol"
                  />
                )}
              </div>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Fuel price (per L)</span>
              <input
                type="number"
                value={fuelPrice}
                onChange={(event) => setFuelPrice(Number(event.target.value))}
                min={0}
                step={0.01}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                placeholder="e.g. 1.75"
              />
            </label>

            <div className="rounded-lg bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700">Estimated travel time</p>
                <span className="text-sm font-semibold text-slate-900">
                  {travelTime.hours}h {travelTime.minutes}m
                </span>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="rounded-lg bg-white p-3 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Fuel needed
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {totalFuelNeeded.toFixed(2)} L
                  </p>
                </div>
                <div className="rounded-lg bg-white p-3 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Fuel cost
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-900">
                    {currencySymbol}{totalFuelCost.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Price Quote Generator</h2>
          <p className="mt-2 text-sm text-slate-600">
            Build a client quote based on your route cost and additional fees.
          </p>

          <div className="mt-6 space-y-4">
            <label className="block">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">Base cost</span>
                <button
                  type="button"
                  onClick={() => {
                    setBaseCost(Number(totalFuelCost.toFixed(2)));
                    setBaseCostTouched(true);
                  }}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  Import from route cost
                </button>
              </div>
              <input
                type="number"
                value={baseCost}
                onChange={(event) => {
                  setBaseCost(Number(event.target.value));
                  setBaseCostTouched(true);
                }}
                onBlur={() => setBaseCost(Number(baseCost.toFixed(2)))}
                min={0}
                step={0.01}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                placeholder="Total fuel cost"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Tolls / Extra costs</span>
              <input
                type="number"
                value={extraCosts}
                onChange={(event) => setExtraCosts(Number(event.target.value))}
                min={0}
                step={0.01}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                placeholder="e.g. 20"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Profit margin (%)</span>
              <input
                type="number"
                value={profitMargin}
                onChange={(event) => setProfitMargin(Number(event.target.value))}
                min={0}
                step={0.1}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                placeholder="e.g. 15"
              />
            </label>

            <div className="rounded-lg bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-700">Final client quote</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">
                {currencySymbol}{finalQuote.toFixed(2)}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Cargo / Pallet Calculator</h2>
          <p className="mt-2 text-sm text-slate-600">
            Estimate floor space and choose the best vehicle type.
          </p>

          <div className="mt-6 space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">EUR pallets</span>
              <input
                type="number"
                value={pallets}
                onChange={(event) => setPallets(Number(event.target.value))}
                min={0}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                placeholder="Number of pallets"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">Space metric</span>
              <select
                value={spaceMetric}
                onChange={(event) => setSpaceMetric(event.target.value as typeof spaceMetric)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              >
                <option value="sqm">Area (m²)</option>
                <option value="sqft">Area (ft²)</option>
                <option value="cbm">Volume (m³)</option>
                <option value="cft">Volume (ft³)</option>
              </select>
            </label>

            {(spaceMetric === 'cbm' || spaceMetric === 'cft') && (
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Stack height (m)</span>
                <input
                  type="number"
                  value={stackHeight}
                  onChange={(event) => setStackHeight(Number(event.target.value))}
                  min={0.1}
                  step={0.05}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  placeholder="e.g. 1.2"
                />
              </label>
            )}

            <div className="rounded-lg bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700">Required space</p>
                <span className="text-sm font-semibold text-slate-900">
                  {displaySpace.toFixed(2)} {displayUnit}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700">Suggested vehicle</p>
                <span className="rounded-full bg-indigo-50 px-3 py-1 text-sm font-semibold text-indigo-700">
                  {suggestedVehicle}
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
