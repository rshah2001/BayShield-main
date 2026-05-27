import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';
import { cn } from '@/lib/utils';

// Fix bundler-broken default marker icons
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Inject dark popup styles once
if (typeof document !== 'undefined' && !document.getElementById('leaflet-dark-theme')) {
  const style = document.createElement('style');
  style.id = 'leaflet-dark-theme';
  style.textContent = `
    .leaflet-popup-content-wrapper {
      background: rgba(6,12,24,0.95) !important;
      border: 1px solid rgba(255,255,255,0.12) !important;
      border-radius: 16px !important;
      box-shadow: 0 18px 45px rgba(2,6,23,0.35) !important;
      color: #e2e8f0 !important;
    }
    .leaflet-popup-tip { background: rgba(6,12,24,0.95) !important; }
    .leaflet-popup-content { margin: 0 !important; }
    .leaflet-popup-close-button { color: #8aa0bf !important; top: 6px !important; right: 8px !important; }
    .leaflet-container { font-family: Inter, Arial, sans-serif; }
    .leaflet-control-attribution { background: rgba(4,10,20,0.7) !important; color: #4a5568 !important; font-size: 9px !important; }
    .leaflet-control-attribution a { color: #6b7280 !important; }
  `;
  document.head.appendChild(style);
}

function MapController({ onMapReady }: { onMapReady?: (map: L.Map) => void }) {
  const map = useMap();
  useEffect(() => {
    onMapReady?.(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

interface MapViewProps {
  className?: string;
  initialCenter?: [number, number];
  initialZoom?: number;
  onMapReady?: (map: L.Map) => void;
  children?: React.ReactNode;
}

export function MapView({
  className,
  initialCenter = [27.85, -82.65],
  initialZoom = 10,
  onMapReady,
  children,
}: MapViewProps) {
  return (
    <MapContainer
      center={initialCenter}
      zoom={initialZoom}
      className={cn('w-full h-full', className)}
      zoomControl={false}
      style={{ background: '#04101d' }}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        subdomains="abcd"
        maxZoom={20}
      />
      <MapController onMapReady={onMapReady} />
      {children}
    </MapContainer>
  );
}
