import { useState, useRef, useEffect } from "react";
import "./App.css";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { signal } from "@preact/signals-react";
import { useSignals } from "@preact/signals-react/runtime";
import { useQuery, useMutation } from "@tanstack/react-query";

// Imports de Imagens para o Leaflet
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

const cepSignal = signal("");
const numeroSignal = signal("");
const loadingSignal = signal(false);

const defaultIcon = new L.Icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34], // Ajustado para brotar exatamente na ponta
  tooltipAnchor: [16, -28],
});

const homeIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/1946/1946436.png",
  iconSize: [35, 35],
  iconAnchor: [17, 35],
  popupAnchor: [0, -35],
});

const INITIAL_CENTER: [number, number] = [
  -3.0935840800679806, -60.03338909229562,
];

interface CustomMarker {
  id: number;
  position: L.LatLngExpression;
  text: string;
}

export default function App() {
  useSignals();
  const [markers, setMarkers] = useState<CustomMarker[]>([]);
  const [tempPos, setTempPos] = useState<L.LatLng | null>(null);
  const [inputText, setInputText] = useState("");
  const [editingMarker, setEditingMarker] = useState<CustomMarker | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  // Força o Leaflet a recalcular posições sempre que o marcador temporário ou o texto mudar
  useEffect(() => {
    if (mapRef.current) {
      // Esse comando força o Leaflet a redesenhar todos os componentes internos (popups/markers)
      mapRef.current.invalidateSize();
    }
  }, [tempPos, inputText, editingMarker]);

  const { refetch: buscarEndereco } = useQuery({
    queryKey: ["cep", cepSignal.value],
    queryFn: async () => {
      const cleanCEP = cepSignal.value.replace(/\D/g, "");
      const res = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`);
      const data = await res.json();
      if (data.erro) throw new Error("CEP não encontrado");
      return data;
    },
    enabled: false,
    staleTime: 1000 * 60 * 10,
  });

  const geocodeMutation = useMutation({
    mutationFn: async (query: string) => {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
      );
      return res.json();
    },
    onSuccess: (geoData) => {
      if (geoData.length > 0) {
        const newPos = new L.LatLng(
          parseFloat(geoData[0].lat),
          parseFloat(geoData[0].lon),
        );
        setTempPos(null);
        mapRef.current?.flyTo(newPos, 16, { animate: true, duration: 1.5 });

        // O moveend garante que o Popup só abra quando o mapa parar, evitando que ele "descole"
        mapRef.current?.once("moveend", () => {
          setTempPos(newPos);
          mapRef.current?.invalidateSize();
        });
      }
    },
  });

  const localizarCEP = async () => {
    const cleanCEP = cepSignal.value.replace(/\D/g, "");
    if (cleanCEP.length < 8) return;
    loadingSignal.value = true;
    try {
      const { data: apiData } = await buscarEndereco();
      if (apiData) {
        const endereco = `${apiData.logradouro}, ${numeroSignal.value} - ${apiData.localidade}`;
        setInputText(endereco);
        geocodeMutation.mutate(
          `${apiData.logradouro}, ${numeroSignal.value}, ${apiData.localidade}, ${apiData.uf}, Brasil`,
        );
      }
    } finally {
      loadingSignal.value = false;
    }
  };

  function MapInitializer() {
    const map = useMap();
    useEffect(() => {
      mapRef.current = map;
    }, [map]);
    return null;
  }

  function ClickHandler() {
    useMapEvents({
      click(e) {
        setTempPos(e.latlng);
        setInputText("");
        setEditingMarker(null);
      },
    });
    return null;
  }

  const saveOrUpdateMarker = () => {
    if (editingMarker) {
      setMarkers((prev) =>
        prev.map((m) =>
          m.id === editingMarker.id ? { ...m, text: inputText } : m,
        ),
      );
      setEditingMarker(null);
    } else if (tempPos) {
      setMarkers((prev) => [
        ...prev,
        { id: Date.now(), position: tempPos, text: inputText },
      ]);
    }
    setTempPos(null);
    setInputText("");
  };

  const getFormPosition = () => {
    if (!mapRef.current || (!tempPos && !editingMarker))
      return { display: "none" };
    const pos = tempPos || (editingMarker!.position as L.LatLng);
    try {
      const point = mapRef.current.latLngToContainerPoint(pos);
      return {
        top: `${point.y - 180}px`,
        left: `${point.x}px`,
        transform: "translateX(-50%)",
      };
    } catch {
      return { display: "none" };
    }
  };

  return (
    <div className="app-container">
      <div className="map-area">
        <MapContainer
          center={INITIAL_CENTER}
          zoom={13}
          className="leaflet-map"
          trackResize={true}
        >
          <MapInitializer />
          <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
          <ClickHandler />

          <Marker position={INITIAL_CENTER} icon={homeIcon}>
            <Tooltip direction="top">FITec Labs</Tooltip>
            <Popup>Ponto Inicial</Popup>
          </Marker>

          {markers.map((m) => (
            <Marker key={m.id} position={m.position} icon={defaultIcon}>
              <Tooltip direction="top">{m.text}</Tooltip>
              <Popup>
                <strong>Marcador:</strong>
                <br />
                {m.text}
              </Popup>
            </Marker>
          ))}

          {tempPos && (
            <Marker
              position={tempPos}
              icon={defaultIcon}
              eventHandlers={{
                add: (e) => {
                  // Sem o delay, ele tenta abrir antes do marcador existir no DOM do Leaflet
                  setTimeout(() => e.target.openPopup(), 100);
                },
              }}
            >
              <Tooltip permanent direction="top">
                {inputText || "Novo Ponto"}
              </Tooltip>
              {/* O segredo está aqui: autoPan={false} e keepInView={false} */}
              <Popup
                autoPan={false}
                keepInView={false}
                closeButton={false}
                offset={[0, -10]}
              >
                <div style={{ textAlign: "center", minWidth: "140px" }}>
                  <strong>Localizado!</strong>
                  <br />
                  {inputText}
                </div>
              </Popup>
            </Marker>
          )}
        </MapContainer>

        {(tempPos || editingMarker) && (
          <div className="floating-form" style={getFormPosition() as any}>
            <h4>{editingMarker ? "Editar Local" : "Salvar Local"}</h4>
            <input
              type="text"
              value={inputText}
              placeholder="Descrição do local"
              onChange={(e) => setInputText(e.target.value)}
              className="form-input"
            />
            <div className="form-buttons">
              <button onClick={saveOrUpdateMarker} className="btn-save">
                Confirmar
              </button>
              <button
                onClick={() => {
                  setTempPos(null);
                  setEditingMarker(null);
                }}
                className="btn-cancel"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="sidebar">
        <div className="search-section">
          <h3>Localizar por CEP</h3>
          <div className="search-inputs">
            <input
              type="text"
              placeholder="CEP"
              value={cepSignal.value}
              onChange={(e) => (cepSignal.value = e.target.value)}
              style={{ padding: 8 }}
            />
            <input
              type="text"
              placeholder="Número"
              value={numeroSignal.value}
              onChange={(e) => (numeroSignal.value = e.target.value)}
              style={{ padding: 8 }}
            />
            <button
              onClick={localizarCEP}
              disabled={loadingSignal.value || geocodeMutation.isPending}
              className="btn-search"
            >
              {loadingSignal.value || geocodeMutation.isPending
                ? "Buscando..."
                : "Localizar"}
            </button>
            <button
              onClick={() => mapRef.current?.flyTo(INITIAL_CENTER, 15)}
              className="btn-home"
            >
              Focar na Casa
            </button>
          </div>
        </div>
        <hr className="divider" />
        <h3 style={{ color: "black" }}>Meus Locais ({markers.length})</h3>
        <ul className="marker-list">
          {markers.map((m) => (
            <li key={m.id} className="marker-item">
              <span className="marker-info">{m.text}</span>
              <div className="marker-actions">
                <button
                  onClick={() => {
                    setEditingMarker(m);
                    setInputText(m.text);
                    setTempPos(null);
                    mapRef.current?.flyTo(m.position as L.LatLng, 16);
                  }}
                  className="btn-edit"
                >
                  e
                </button>
                <button
                  onClick={() =>
                    setMarkers((prev) => prev.filter((x) => x.id !== m.id))
                  }
                  className="btn-delete"
                >
                  x
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
