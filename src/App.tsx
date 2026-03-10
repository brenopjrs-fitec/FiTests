import { useState, useRef, useEffect } from "react";
import "./App.css";
import L from "leaflet";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

// Correção do ícone padrão do Leaflet
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

interface CustomMarker {
  id: number;
  position: L.LatLngExpression;
  text: string;
}

export default function App() {
  const [markers, setMarkers] = useState<CustomMarker[]>([]);
  const [tempPos, setTempPos] = useState<L.LatLng | null>(null);
  const [inputText, setInputText] = useState("");
  const [editingMarker, setEditingMarker] = useState<CustomMarker | null>(null);

  const mapRef = useRef<L.Map | null>(null);

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
    if (!inputText.trim()) return;

    if (editingMarker) {
      setMarkers((prev) =>
        prev.map((m) =>
          m.id === editingMarker.id ? { ...m, text: inputText } : m,
        ),
      );
      setEditingMarker(null);
    } else if (tempPos) {
      const newMarker: CustomMarker = {
        id: Date.now(),
        position: tempPos,
        text: inputText,
      };
      setMarkers((prev) => [...prev, newMarker]);
    }

    setTempPos(null);
    setInputText("");
  };

  const cancel = () => {
    setTempPos(null);
    setEditingMarker(null);
    setInputText("");
  };

  const startEdit = (marker: CustomMarker) => {
    setEditingMarker(marker);
    setInputText(marker.text);
    setTempPos(null);
  };

  const deleteMarker = (id: number) => {
    setMarkers((prev) => prev.filter((m) => m.id !== id));
  };

  const getFormPosition = () => {
    if (!mapRef.current || (!tempPos && !editingMarker)) {
      return { top: "20px", left: "50%", transform: "translateX(-50%)" };
    }

    const pos = tempPos || editingMarker!.position;
    const point = mapRef.current.latLngToContainerPoint(pos);
    return {
      top: `${point.y - 180}px`,
      left: `${point.x}px`,
      transform: "translateX(-50%)",
    };
  };

  return (
    <div className="app-container">
      {/* Área do mapa */}
      <div className="map-area">
        <MapContainer
          center={[2.9464684079846943, -61.004459351411455]}
          zoom={13}
          className="leaflet-map"
        >
          <MapInitializer />
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/atributions">CARTO</a>'
          />
          <ClickHandler />

          {markers.map((marker) => (
            <Marker key={marker.id} position={marker.position}>
              <Popup>{marker.text}</Popup>
            </Marker>
          ))}

          {tempPos && (
            <Marker position={tempPos}>
              <Popup autoClose={false}>
                Prévia: {inputText || "Digite algo"}
              </Popup>
            </Marker>
          )}
        </MapContainer>

        {(tempPos || editingMarker) && (
          <div className="floating-form" style={getFormPosition()}>
            <h4>{editingMarker ? "Editar Marcador" : "Novo Marcador"}</h4>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Digite o texto do popup..."
              className="form-input"
            />
            <div className="form-buttons">
              <button onClick={saveOrUpdateMarker} className="btn-save">
                {editingMarker ? "Atualizar" : "Salvar"}
              </button>
              <button onClick={cancel} className="btn-cancel">
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sidebar */}
      <div className="sidebar">
        <h3>Marcadores Registrados ({markers.length})</h3>

        {markers.length === 0 ? (
          <p className="no-markers">Nenhum marcador ainda.</p>
        ) : (
          <ul className="marker-list">
            {markers.map((marker) => (
              <li key={marker.id} className="marker-item">
                <div className="marker-info">
                  {marker.text.substring(0, 40)}
                  {marker.text.length > 40 ? "..." : ""}
                </div>
                <div className="marker-actions">
                  <button
                    onClick={() => startEdit(marker)}
                    className="btn-edit"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => deleteMarker(marker.id)}
                    className="btn-delete"
                  >
                    Excluir
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
