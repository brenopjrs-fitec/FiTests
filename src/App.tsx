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

// 1. Signals para busca (Performance fluida nos inputs)
import { signal } from "@preact/signals-react";
import { useSignals } from "@preact/signals-react/runtime";

const cepSignal = signal("");
const numeroSignal = signal("");
const loadingSignal = signal(false);

// 2. Configuração de Ícones do Leaflet
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
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
  useSignals(); // Habilita o rastreamento de Signals

  // Estados principais
  const [markers, setMarkers] = useState<CustomMarker[]>([]);
  const [tempPos, setTempPos] = useState<L.LatLng | null>(null);
  const [inputText, setInputText] = useState("");
  const [editingMarker, setEditingMarker] = useState<CustomMarker | null>(null);

  const mapRef = useRef<L.Map | null>(null);

  // --- Helpers do Mapa ---
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

  // --- Lógica de Busca por CEP ---
  const localizarCEP = async () => {
    const cleanCEP = cepSignal.value.replace(/\D/g, "");
    if (cleanCEP.length < 8) return;

    loadingSignal.value = true;
    try {
      // Busca endereço
      const res = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`);
      const data = await res.json();

      if (data.error) {
        alert("CEP não encontrado.");
        return;
      }

      const query = `${data.logradouro}, ${numeroSignal.value}, ${data.localidade}, ${data.uf}, Brasil`;
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
      );
      const geoData = await geoRes.json();

      if (geoData.length > 0) {
        const newPos = new L.LatLng(
          parseFloat(geoData[0].lat),
          parseFloat(geoData[0].lon),
        );
        const enderecoFormatado = `${data.logradouro}, ${numeroSignal.value} - ${data.localidade}`;

        mapRef.current?.flyTo(newPos, 16);
        setTempPos(newPos);

        // Injeta o endereço no texto do marcador automaticamente
        setInputText(enderecoFormatado);
      } else {
        alert("Endereço encontrado, mas não conseguimos obter as coordenadas.");
      }
    } catch (err) {
      alert("Erro na conexão.");
    } finally {
      loadingSignal.value = false;
    }
  };

  // --- Operações de Marcadores ---
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

  const deleteMarker = (id: number) =>
    setMarkers((prev) => prev.filter((m) => m.id !== id));

  const startEdit = (marker: CustomMarker) => {
    setEditingMarker(marker);
    setInputText(marker.text);
    setTempPos(null);
    mapRef.current?.panTo(marker.position as L.LatLngExpression);
  };

  // Cálculo da posição do formulário na tela
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
        <MapContainer center={INITIAL_CENTER} zoom={13} className="leaflet-map">
          <MapInitializer />
          <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
          <ClickHandler />

          {/* Marcador Home */}
          <Marker position={INITIAL_CENTER} icon={homeIcon}>
            <Tooltip direction="top">FITec Labs</Tooltip>
            <Popup>Minha Casa (Ponto Inicial)</Popup>
          </Marker>

          {/* Lista de Marcadores */}
          {markers.map((m) => (
            <Marker key={m.id} position={m.position}>
              <Tooltip direction="top" offset={[0, -32]}>
                {m.text}
              </Tooltip>
              <Popup>
                <strong>Marcador:</strong>
                <br />
                {m.text}
              </Popup>
            </Marker>
          ))}

          {/* Prévia do Marcador (Usado na Busca ou Clique) */}
          {tempPos && (
            <Marker position={tempPos}>
              <Tooltip permanent direction="top" offset={[0, -32]}>
                {inputText || "Novo Ponto"}
              </Tooltip>
              <Popup autoClose={false}>
                <strong>Endereço Encontrado:</strong>
                <br />
                {inputText || "Defina um nome ou confirme o endereço"}
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
              onChange={(e) => setInputText(e.target.value)}
              className="form-input"
              placeholder="Nome ou endereço do local"
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
            />
            <input
              type="text"
              placeholder="Número"
              value={numeroSignal.value}
              onChange={(e) => (numeroSignal.value = e.target.value)}
            />
            <button
              onClick={localizarCEP}
              disabled={loadingSignal.value}
              className="btn-search"
            >
              {loadingSignal.value ? "Pesquisando..." : "Localizar"}
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

        <h3>Meus Locais ({markers.length})</h3>
        <ul className="marker-list">
          {markers.map((m) => (
            <li key={m.id} className="marker-item">
              <span title={m.text}>{m.text}</span>
              <div className="marker-actions">
                <button onClick={() => startEdit(m)} className="btn-edit">
                  e
                </button>
                <button
                  onClick={() => deleteMarker(m.id)}
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
