import { useEffect, useMemo, useState } from 'react';
import { CircleMarker, MapContainer, Polyline, TileLayer } from 'react-leaflet';
import { adminApi } from '../api';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';

type Session = Record<string, any>;
type SessionEvent = { id: string; type: string; timestamp: string; payload: string };
type Coordinate = { lat: number; lng: number; timestamp?: number; accuracy?: number };

function safeParseJson(raw: unknown): Record<string, unknown> | null {
  if (typeof raw !== 'string') return null;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function parseTransitPath(value: unknown): Coordinate[] {
  if (typeof value !== 'string') return [];
  try {
    const parsed = JSON.parse(value) as Array<{ lat: number; lng: number; timestamp?: number; accuracy?: number }>;
    return parsed.filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
  } catch {
    return [];
  }
}

function distanceBetween(first: Coordinate, second: Coordinate) {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRadians(second.lat - first.lat);
  const dLng = toRadians(second.lng - first.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(first.lat)) * Math.cos(toRadians(second.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function eventTone(type: string): 'success' | 'danger' | 'muted' {
  if (type === 'answer_valid' || type === 'arrival') return 'success';
  if (type === 'answer_invalid' || type === 'deviation_detected' || type === 'signal_lost') return 'danger';
  return 'muted';
}

export function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selected, setSelected] = useState<Session | null>(null);
  const [detail, setDetail] = useState<Record<string, any> | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'finished'>('all');

  useEffect(() => {
    void adminApi.sessions().then((data) => setSessions(data as Session[]));
  }, []);

  async function openDetail(session: Session) {
    setSelected(session);
    const data = await adminApi.sessionDetail(String(session.id));
    setDetail(data);
  }

  const filtered = sessions.filter((session) => {
    if (filter === 'active') return !session.finishedAt;
    if (filter === 'finished') return Boolean(session.finishedAt);
    return true;
  });

  const path = useMemo(() => parseTransitPath(detail?.transitPath), [detail?.transitPath]);
  const eventMarkers = useMemo(
    () =>
      (Array.isArray(detail?.events) ? (detail.events as SessionEvent[]) : [])
        .map((event) => {
          const payload = safeParseJson(event.payload);
          const lat = Number(payload?.latitude ?? payload?.lat);
          const lng = Number(payload?.longitude ?? payload?.lng);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
          return {
            id: event.id,
            type: event.type,
            timestamp: event.timestamp,
            lat,
            lng
          };
        })
        .filter(Boolean) as Array<{ id: string; type: string; timestamp: string; lat: number; lng: number }>,
    [detail?.events]
  );
  const placeMarkers = useMemo(
    () =>
      Array.isArray(detail?.city?.missions)
        ? detail.city.missions.map((mission: any) => ({
            id: String(mission.id),
            title: String(mission.title),
            lat: Number(mission.place?.latitude),
            lng: Number(mission.place?.longitude)
          }))
        : [],
    [detail?.city?.missions]
  );
  const totalDistance = useMemo(() => {
    return path.slice(1).reduce((sum, point, index) => sum + distanceBetween(path[index], point), 0);
  }, [path]);
  const elapsedSeconds = Number(detail?.elapsedSeconds ?? 0);
  const movingSeconds = Math.max(0, path.length - 1) * 10;
  const fallbackCount = (Array.isArray(detail?.events) ? detail.events : []).filter((event: any) => event.type === 'fallback_used').length;

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
      <div className="space-y-3">
        <div className="flex gap-2">
          {(['all', 'active', 'finished'] as const).map((value) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`rounded-sm px-3 py-1.5 font-sans text-adminLabel transition ${
                filter === value ? 'bg-admin-text text-white' : 'border border-admin-border text-admin-muted hover:bg-admin-bg'
              }`}
            >
              {value === 'all' ? 'Tutte' : value === 'active' ? 'Attive' : 'Concluse'}
            </button>
          ))}
        </div>
        <Card className="max-h-[70vh] overflow-hidden overflow-y-auto p-0">
          {filtered.length === 0 ? (
            <div className="p-4 font-sans text-adminBody text-admin-muted">Nessuna sessione.</div>
          ) : (
            filtered.map((session) => (
              <button
                key={String(session.id)}
                onClick={() => void openDetail(session)}
                className={`w-full border-b border-admin-border px-4 py-3 text-left transition last:border-0 hover:bg-admin-bg ${
                  selected?.id === session.id ? 'bg-admin-bg' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-sans text-adminBody font-medium text-admin-text">{String(session.alias)}</span>
                  <Badge tone={session.finishedAt ? 'muted' : 'success'}>{session.finishedAt ? 'Conclusa' : 'Attiva'}</Badge>
                </div>
                <div className="mt-1 font-sans text-adminLabel text-admin-muted">
                  {String(session.city?.name ?? '-')} · {new Date(String(session.startedAt)).toLocaleString('it-IT')}
                </div>
              </button>
            ))
          )}
        </Card>
      </div>

      {detail ? (
        <div className="space-y-4">
          <Card className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-sans text-adminTitle font-semibold text-admin-text">{String(detail.alias)}</h2>
                <div className="mt-1 font-sans text-adminBody text-admin-muted">
                  {String(detail.city?.name ?? '-')} · iniziata {new Date(String(detail.startedAt)).toLocaleString('it-IT')}
                </div>
                {detail.finishedAt ? (
                  <div className="mt-1 font-sans text-adminLabel text-admin-muted">
                    conclusa {new Date(String(detail.finishedAt)).toLocaleString('it-IT')}
                  </div>
                ) : null}
              </div>
              <Badge tone={detail.finishedAt ? 'muted' : 'success'}>{detail.finishedAt ? 'Conclusa' : 'Attiva'}</Badge>
            </div>
          </Card>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <Card className="p-0">
              <div className="h-[420px] overflow-hidden rounded-md">
                {path.length > 0 || placeMarkers.length > 0 ? (
                  <MapContainer
                    center={[
                      path[0]?.lat ?? placeMarkers[0]?.lat ?? 40.0562,
                      path[0]?.lng ?? placeMarkers[0]?.lng ?? 17.9925
                    ]}
                    zoom={16}
                    className="h-full w-full"
                    zoomControl={false}
                    attributionControl={false}
                  >
                    <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
                    {path.length > 1 ? (
                      <Polyline positions={path.map((point) => [point.lat, point.lng])} pathOptions={{ color: '#1a1a1a', weight: 3, opacity: 0.85 }} />
                    ) : null}
                    {placeMarkers.map((place: { id: string; title: string; lat: number; lng: number }) => (
                      <CircleMarker
                        key={place.id}
                        center={[place.lat, place.lng]}
                        radius={6}
                        pathOptions={{ color: '#8a6a20', fillColor: '#8a6a20', fillOpacity: 0.9 }}
                      />
                    ))}
                    {eventMarkers.map((event) => (
                      <CircleMarker
                        key={event.id}
                        center={[event.lat, event.lng]}
                        radius={5}
                        pathOptions={{
                          color: event.type === 'deviation_detected' ? '#a82020' : '#1a1a1a',
                          fillColor: event.type === 'arrival' ? '#2a7a40' : '#ffffff',
                          fillOpacity: 0.95
                        }}
                      />
                    ))}
                  </MapContainer>
                ) : (
                  <div className="flex h-full items-center justify-center font-sans text-adminBody text-admin-muted">
                    Nessun dato GPS disponibile
                  </div>
                )}
              </div>
            </Card>

            <div className="space-y-4">
              <Card className="p-4">
                <div className="font-sans text-adminLabel uppercase tracking-[0.18em] text-admin-muted">Metriche</div>
                <div className="mt-3 space-y-2 font-sans text-adminBody text-admin-text">
                  <div>Distanza totale: {(totalDistance / 1000).toFixed(2)} km</div>
                  <div>Tempo totale: {Math.round(elapsedSeconds / 60)} min</div>
                  <div>Tempo in movimento stimato: {Math.round(movingSeconds / 60)} min</div>
                  <div>Tempo fermo stimato: {Math.max(0, Math.round((elapsedSeconds - movingSeconds) / 60))} min</div>
                  <div>Fallback manuali: {fallbackCount}</div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="font-sans text-adminLabel uppercase tracking-[0.18em] text-admin-muted">Eventi geospaziali</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {['arrival', 'deviation_detected', 'idle_detected', 'fallback_used'].map((type) => (
                    <Badge key={type} tone={type === 'arrival' ? 'success' : type === 'fallback_used' ? 'muted' : 'danger'}>
                      {type}: {(Array.isArray(detail.events) ? detail.events : []).filter((event: any) => event.type === type).length}
                    </Badge>
                  ))}
                </div>
              </Card>
            </div>
          </div>

          <Card className="p-6">
            <h3 className="mb-4 font-sans text-adminHeading font-semibold text-admin-text">
              Timeline eventi ({Array.isArray(detail.events) ? detail.events.length : 0})
            </h3>
            {Array.isArray(detail.events) && detail.events.length > 0 ? (
              <div className="space-y-4">
                {(detail.events as SessionEvent[]).map((event) => {
                  const parsed = safeParseJson(event.payload);
                  return (
                    <div key={event.id} className="flex gap-4">
                      <div className="w-24 shrink-0 pt-0.5 font-sans text-adminLabel text-admin-muted">
                        {new Date(event.timestamp).toLocaleTimeString('it-IT')}
                      </div>
                      <div className="min-w-0">
                        <Badge tone={eventTone(event.type)}>{event.type}</Badge>
                        {parsed && Object.keys(parsed).length > 0 ? (
                          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-xs text-admin-muted">
                            {JSON.stringify(parsed, null, 2)}
                          </pre>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="font-sans text-adminBody text-admin-muted">Nessun evento registrato.</div>
            )}
          </Card>
        </div>
      ) : (
        <Card className="flex items-center justify-center p-12">
          <span className="font-sans text-adminBody text-admin-muted">Seleziona una sessione per vederne il dettaglio</span>
        </Card>
      )}
    </div>
  );
}
