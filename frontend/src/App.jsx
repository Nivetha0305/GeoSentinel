import { useEffect, useMemo, useState } from 'react'
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet'
import './App.css'

const API = 'https://geosentinel-backend-2uo9.onrender.com'
const NILGIRIS_CENTER = [11.25, 76.7]

const RISK_COLORS = {
  Low: '#22c55e',
  Moderate: '#eab308',
  High: '#f97316',
  Critical: '#ef4444',
}

const PRESETS = {
  calm: {
    Rainfall: 20,
    NDWI: -0.66,
    Elevation: 1600,
    Slope: 8,
    NDVI: 0.73,
    Month: 2,
    VH: -15.2,
    VV: -8.7,
  },
  monsoon: {
    Rainfall: 420,
    NDWI: -0.2,
    Elevation: 480,
    Slope: 32,
    NDVI: 0.28,
    Month: 8,
    VH: -18,
    VV: -12,
  },
}

const emptyForm = {
  Rainfall: 98,
  NDWI: -0.56,
  Elevation: 770,
  Slope: 12,
  NDVI: 0.58,
  Month: 6,
  VH: -15.2,
  VV: -8.7,
}

function App() {
  const [form, setForm] = useState(emptyForm)
  const [result, setResult] = useState(null)
  const [points, setPoints] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [mapLoading, setMapLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`${API}/stats`)
      .then((res) => res.json())
      .then(setStats)
      .catch(() => {})

    fetch(`${API}/map-data?limit=400`)
      .then((res) => {
        if (!res.ok) throw new Error('Map data failed. Keep the backend running.')
        return res.json()
      })
      .then((data) => setPoints(data.points || []))
      .catch((err) => setError(err.message))
      .finally(() => setMapLoading(false))

    runPredict(emptyForm)
  }, [])

  const risk = result?.risk_level || 'Low'
  const probability = result ? Math.round(result.probability * 100) : 0

  const mapCounts = useMemo(() => {
    const counts = { Low: 0, Moderate: 0, High: 0, Critical: 0 }
    for (const point of points) {
      counts[point.risk_level] = (counts[point.risk_level] || 0) + 1
    }
    return counts
  }, [points])

  function updateField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  async function runPredict(payload = form) {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`${API}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Elevation: Number(payload.Elevation),
          Month: Number(payload.Month),
          NDVI: Number(payload.NDVI),
          NDWI: Number(payload.NDWI),
          Rainfall: Number(payload.Rainfall),
          Slope: Number(payload.Slope),
          VH: Number(payload.VH),
          VV: Number(payload.VV),
        }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.detail || 'Prediction failed. Start uvicorn in backend.')
      }
      setResult(await response.json())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  function usePoint(point) {
    const next = {
      Rainfall: Number(point.Rainfall.toFixed(1)),
      NDWI: Number(point.NDWI.toFixed(3)),
      Elevation: Number(point.Elevation.toFixed(0)),
      Slope: Number(point.Slope.toFixed(1)),
      NDVI: Number(point.NDVI.toFixed(3)),
      Month: point.Month,
      VH: Number(point.VH.toFixed(2)),
      VV: Number(point.VV.toFixed(2)),
    }
    setForm(next)
    runPredict(next)
  }

  function applyPreset(name) {
    const next = PRESETS[name]
    setForm(next)
    runPredict(next)
  }

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <p className="kicker">Nilgiris · AI early warning</p>
          <h1>GeoSentinel</h1>
          <p className="subtitle">
            Flash flood risk monitoring from rainfall, terrain and satellite moisture
            {stats ? ` · ${stats.rows.toLocaleString()} records · ${stats.years}` : ''}
          </p>
        </div>
        <div className={`risk-badge ${risk.toLowerCase()}`}>
          <span>CURRENT FLOOD RISK</span>
          <strong>{result ? risk.toUpperCase() : 'SCANNING'}</strong>
          <em>{result ? `${probability}% probability` : 'Connecting to model…'}</em>
        </div>
      </header>

      {result && (
        <div className={`alert-banner ${risk.toLowerCase()}`}>
          {risk === 'Critical' ? '🚨 ' : risk === 'High' ? '⚠️ ' : ''}
          {result.alert}
        </div>
      )}
      {error && <div className="alert-banner critical">{error}</div>}

      <section className="level-row">
        {Object.keys(RISK_COLORS).map((level) => (
          <div key={level} className={`level-chip ${result?.risk_level === level ? 'active' : ''}`}>
            <i style={{ background: RISK_COLORS[level] }} />
            {level}
          </div>
        ))}
      </section>

      <section className="cards">
        <EnvCard icon="🌧️" label="Rainfall" value={`${form.Rainfall} mm`} />
        <EnvCard icon="💧" label="Surface moisture" value={form.NDWI} />
        <EnvCard icon="⛰️" label="Elevation" value={`${form.Elevation} m`} />
        <EnvCard icon="📐" label="Slope" value={`${form.Slope}°`} />
        <EnvCard icon="🌿" label="Vegetation NDVI" value={form.NDVI} />
      </section>

      <section className="workspace">
        <form
          className="panel"
          onSubmit={(event) => {
            event.preventDefault()
            runPredict()
          }}
        >
          <h2>Environmental inputs</h2>
          <p className="hint">Nilgiris CSV features · map click fills the form</p>

          <div className="preset-row">
            <button type="button" className="ghost" onClick={() => applyPreset('calm')}>
              Calm day
            </button>
            <button type="button" className="ghost danger" onClick={() => applyPreset('monsoon')}>
              Monsoon extreme
            </button>
          </div>

          <Field label="Rainfall (mm)" value={form.Rainfall} onChange={(v) => updateField('Rainfall', v)} min="0" max="1000" step="1" />
          <Field label="NDWI moisture" value={form.NDWI} onChange={(v) => updateField('NDWI', v)} min="-1" max="1" step="0.01" />
          <Field label="Elevation (m)" value={form.Elevation} onChange={(v) => updateField('Elevation', v)} min="40" max="2600" step="1" />
          <Field label="Slope (°)" value={form.Slope} onChange={(v) => updateField('Slope', v)} min="0" max="80" step="0.1" />
          <Field label="NDVI" value={form.NDVI} onChange={(v) => updateField('NDVI', v)} min="-1" max="1" step="0.01" />
          <Field label="Month" value={form.Month} onChange={(v) => updateField('Month', v)} min="1" max="12" step="1" />
          <Field label="SAR VH" value={form.VH} onChange={(v) => updateField('VH', v)} min="-45" max="5" step="0.1" />
          <Field label="SAR VV" value={form.VV} onChange={(v) => updateField('VV', v)} min="-40" max="15" step="0.1" />

          <button type="submit" disabled={loading}>
            {loading ? 'Predicting…' : 'Predict flood risk'}
          </button>

          {result?.class_probabilities && (
            <div className="probs">
              {Object.entries(result.class_probabilities).map(([level, value]) => (
                <div key={level}>
                  <span>{level}</span>
                  <div className="bar">
                    <em style={{ width: `${Math.round(value * 100)}%`, background: RISK_COLORS[level] }} />
                  </div>
                  <b>{Math.round(value * 100)}%</b>
                </div>
              ))}
            </div>
          )}
        </form>

        <div className="panel map-panel">
          <div className="map-head">
            <h2>GIS risk map</h2>
            <div className="legend">
              {Object.entries(RISK_COLORS).map(([level, color]) => (
                <span key={level}>
                  <i style={{ background: color }} />
                  {level} ({mapCounts[level] || 0})
                </span>
              ))}
            </div>
          </div>
          {mapLoading ? (
            <p className="hint">Loading Nilgiris sample points…</p>
          ) : (
            <MapContainer center={NILGIRIS_CENTER} zoom={9} className="map">
              <TileLayer
                attribution="&copy; OpenStreetMap"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {points.map((point, index) => (
                <CircleMarker
                  key={`${point.latitude}-${point.longitude}-${index}`}
                  center={[point.latitude, point.longitude]}
                  radius={6}
                  pathOptions={{
                    color: RISK_COLORS[point.risk_level],
                    fillColor: RISK_COLORS[point.risk_level],
                    fillOpacity: 0.75,
                    weight: 1,
                  }}
                  eventHandlers={{ click: () => usePoint(point) }}
                >
                  <Popup>
                    <strong>{point.risk_level}</strong>
                    <br />
                    Probability: {Math.round(point.probability * 100)}%
                    <br />
                    Rainfall: {point.Rainfall.toFixed(1)} mm
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          )}
        </div>
      </section>
    </div>
  )
}

function EnvCard({ icon, label, value }) {
  return (
    <article className="env-card">
      <span>{icon}</span>
      <p>{label}</p>
      <strong>{value}</strong>
    </article>
  )
}

function Field({ label, value, onChange, min, max, step }) {
  return (
    <label className="field">
      <span>
        {label}
        <b>{value}</b>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

export default App
