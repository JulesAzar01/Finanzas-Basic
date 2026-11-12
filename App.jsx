import { useEffect, useMemo, useState } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts'

/* ---------- Constantes ---------- */
const CATEGORIAS_EGRESO = ['Alimentación', 'Transporte', 'Salud', 'Entretenimiento', 'Educación']
const CATEGORIAS_INGRESO = ['Sueldo', 'Negocio / Freelance', 'Otros ingresos']
const TIPOS_GASTO = ['Hormiga', 'Necesario', 'Innecesario']
const MEDIOS_PAGO = ['Tarjeta de Débito', 'Tarjeta de Crédito', 'Yape', 'Efectivo']
const COLORES = ['#0f766e', '#2563eb', '#d97706', '#9333ea', '#dc2626', '#64748b']
const STORAGE_KEY = 'mis-finanzas:transacciones'

/* ---------- Utilidades ---------- */
const pad = (n) => String(n).padStart(2, '0')
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const hoy = () => toISO(new Date())
const soles = (n) =>
  'S/ ' + Number(n).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fechaCorta = (iso) => {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// Rango de fechas (inclusive) para cada filtro. Semana: lunes a domingo.
function rangoFiltro(filtro) {
  const now = new Date()
  if (filtro === 'semana') {
    const diaSemana = (now.getDay() + 6) % 7 // lunes = 0
    const lunesActual = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diaSemana)
    const inicio = new Date(lunesActual.getFullYear(), lunesActual.getMonth(), lunesActual.getDate() - 7)
    const fin = new Date(lunesActual.getFullYear(), lunesActual.getMonth(), lunesActual.getDate() - 1)
    return { inicio: toISO(inicio), fin: toISO(fin) }
  }
  const inicio = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const fin = new Date(now.getFullYear(), now.getMonth(), 0)
  return { inicio: toISO(inicio), fin: toISO(fin) }
}

function agrupar(lista, clave) {
  const mapa = {}
  lista.forEach((t) => {
    mapa[t[clave]] = (mapa[t[clave]] || 0) + t.monto
  })
  return Object.entries(mapa)
    .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => b.value - a.value)
}

const formVacio = () => ({
  tipo: 'egreso',
  fecha: hoy(),
  monto: '',
  categoria: '',
  descripcion: '',
  tipoGasto: '',
  medioPago: ''
})

/* ---------- App ---------- */
export default function App() {
  const [transacciones, setTransacciones] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []
    } catch {
      return []
    }
  })
  const [vista, setVista] = useState('nuevo')
  const [form, setForm] = useState(formVacio())
  const [editandoId, setEditandoId] = useState(null)
  const [filtro, setFiltro] = useState('semana')
  const [filtroHistorial, setFiltroHistorial] = useState('todos')
  const [aviso, setAviso] = useState('')

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transacciones))
  }, [transacciones])

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(''), 2200)
    return () => clearTimeout(t)
  }, [aviso])

  const categorias = form.tipo === 'egreso' ? CATEGORIAS_EGRESO : CATEGORIAS_INGRESO

  const cambiarCampo = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }))

  const cambiarTipo = (tipo) =>
    setForm((f) => ({ ...f, tipo, categoria: '', tipoGasto: '', medioPago: '' }))

  const guardar = (e) => {
    e.preventDefault()
    const monto = parseFloat(form.monto)
    if (!(monto > 0)) return

    const base = {
      tipo: form.tipo,
      fecha: form.fecha,
      monto: Math.round(monto * 100) / 100,
      categoria: form.categoria,
      descripcion: form.descripcion.trim(),
      tipoGasto: form.tipo === 'egreso' ? form.tipoGasto : null,
      medioPago: form.tipo === 'egreso' ? form.medioPago : null
    }

    if (editandoId) {
      setTransacciones((lista) => lista.map((t) => (t.id === editandoId ? { ...t, ...base } : t)))
      setAviso('Cambios guardados')
      setEditandoId(null)
      setForm(formVacio())
      setVista('historial')
    } else {
      setTransacciones((lista) => [{ id: crypto.randomUUID(), ...base }, ...lista])
      setAviso(form.tipo === 'egreso' ? 'Egreso registrado' : 'Ingreso registrado')
      setForm({ ...formVacio(), tipo: form.tipo, fecha: form.fecha })
    }
  }

  const empezarEdicion = (t) => {
    setEditandoId(t.id)
    setForm({
      tipo: t.tipo,
      fecha: t.fecha,
      monto: String(t.monto),
      categoria: t.categoria,
      descripcion: t.descripcion || '',
      tipoGasto: t.tipoGasto || '',
      medioPago: t.medioPago || ''
    })
    setVista('nuevo')
    window.scrollTo({ top: 0 })
  }

  const cancelarEdicion = () => {
    setEditandoId(null)
    setForm(formVacio())
    setVista('historial')
  }

  const eliminar = (t) => {
    if (window.confirm(`¿Eliminar "${t.categoria}" por ${soles(t.monto)}?`)) {
      setTransacciones((lista) => lista.filter((x) => x.id !== t.id))
      setAviso('Registro eliminado')
    }
  }

  /* ----- Historial ----- */
  const historial = useMemo(
    () =>
      [...transacciones]
        .filter((t) => filtroHistorial === 'todos' || t.tipo === filtroHistorial)
        .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0)),
    [transacciones, filtroHistorial]
  )

  /* ----- Dashboard ----- */
  const rango = useMemo(() => rangoFiltro(filtro), [filtro])
  const delPeriodo = useMemo(
    () => transacciones.filter((t) => t.fecha >= rango.inicio && t.fecha <= rango.fin),
    [transacciones, rango]
  )
  const egresos = delPeriodo.filter((t) => t.tipo === 'egreso')
  const ingresos = delPeriodo.filter((t) => t.tipo === 'ingreso')
  const totalEgresos = egresos.reduce((s, t) => s + t.monto, 0)
  const totalIngresos = ingresos.reduce((s, t) => s + t.monto, 0)
  const porCategoria = useMemo(() => agrupar(egresos, 'categoria'), [egresos])
  const porTipoGasto = useMemo(() => agrupar(egresos, 'tipoGasto'), [egresos])
  const porMedio = useMemo(() => agrupar(egresos, 'medioPago'), [egresos])

  return (
    <div className="app">
      <header className="topbar">
        <h1>Mis Finanzas</h1>
        <span className="moneda">Soles (S/)</span>
      </header>

      {aviso && <div className="toast">{aviso}</div>}

      <main className="contenido">
        {/* ===== FORMULARIO ===== */}
        {vista === 'nuevo' && (
          <section className="card">
            <h2>{editandoId ? 'Editar movimiento' : 'Nuevo movimiento'}</h2>
            <form onSubmit={guardar}>
              <div className="segmento">
                <button
                  type="button"
                  className={form.tipo === 'egreso' ? 'activo egreso' : ''}
                  onClick={() => cambiarTipo('egreso')}
                >
                  Egreso
                </button>
                <button
                  type="button"
                  className={form.tipo === 'ingreso' ? 'activo ingreso' : ''}
                  onClick={() => cambiarTipo('ingreso')}
                >
                  Ingreso
                </button>
              </div>

              <label>
                Fecha
                <input
                  type="date"
                  required
                  value={form.fecha}
                  onChange={(e) => cambiarCampo('fecha', e.target.value)}
                />
              </label>

              <label>
                Monto (S/)
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0.00"
                  value={form.monto}
                  onChange={(e) => cambiarCampo('monto', e.target.value)}
                />
              </label>

              <label>
                Categoría
                <select
                  required
                  value={form.categoria}
                  onChange={(e) => cambiarCampo('categoria', e.target.value)}
                >
                  <option value="">Selecciona…</option>
                  {categorias.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>

              {form.tipo === 'egreso' && (
                <>
                  <label>
                    Tipo de gasto
                    <select
                      required
                      value={form.tipoGasto}
                      onChange={(e) => cambiarCampo('tipoGasto', e.target.value)}
                    >
                      <option value="">Selecciona…</option>
                      {TIPOS_GASTO.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Medio de pago
                    <select
                      required
                      value={form.medioPago}
                      onChange={(e) => cambiarCampo('medioPago', e.target.value)}
                    >
                      <option value="">Selecciona…</option>
                      {MEDIOS_PAGO.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                </>
              )}

              <label>
                Detalle (opcional)
                <input
                  type="text"
                  maxLength={80}
                  placeholder="Ej. Almuerzo en el trabajo"
                  value={form.descripcion}
                  onChange={(e) => cambiarCampo('descripcion', e.target.value)}
                />
              </label>

              <button type="submit" className="btn-principal">
                {editandoId ? 'Guardar cambios' : 'Registrar'}
              </button>
              {editandoId && (
                <button type="button" className="btn-secundario" onClick={cancelarEdicion}>
                  Cancelar
                </button>
              )}
            </form>
          </section>
        )}

        {/* ===== HISTORIAL ===== */}
        {vista === 'historial' && (
          <section>
            <div className="segmento chico">
              {[['todos', 'Todos'], ['egreso', 'Egresos'], ['ingreso', 'Ingresos']].map(([k, label]) => (
                <button
                  key={k}
                  className={filtroHistorial === k ? 'activo' : ''}
                  onClick={() => setFiltroHistorial(k)}
                >
                  {label}
                </button>
              ))}
            </div>

            {historial.length === 0 ? (
              <p className="vacio">Aún no hay movimientos registrados.</p>
            ) : (
              <ul className="lista">
                {historial.map((t) => (
                  <li key={t.id} className="item">
                    <div className="item-info">
                      <strong>{t.categoria}</strong>
                      <span className="sub">
                        {fechaCorta(t.fecha)}
                        {t.tipo === 'egreso' && ` · ${t.tipoGasto} · ${t.medioPago}`}
                      </span>
                      {t.descripcion && <span className="sub">{t.descripcion}</span>}
                    </div>
                    <div className="item-lado">
                      <span className={t.tipo === 'egreso' ? 'monto neg' : 'monto pos'}>
                        {t.tipo === 'egreso' ? '−' : '+'} {soles(t.monto)}
                      </span>
                      <div className="acciones">
                        <button onClick={() => empezarEdicion(t)}>Editar</button>
                        <button className="peligro" onClick={() => eliminar(t)}>Borrar</button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* ===== DASHBOARD ===== */}
        {vista === 'dashboard' && (
          <section>
            <div className="segmento">
              <button className={filtro === 'semana' ? 'activo' : ''} onClick={() => setFiltro('semana')}>
                La semana pasada
              </button>
              <button className={filtro === 'mes' ? 'activo' : ''} onClick={() => setFiltro('mes')}>
                El mes pasado
              </button>
            </div>
            <p className="rango">
              {fechaCorta(rango.inicio)} al {fechaCorta(rango.fin)}
            </p>

            <div className="resumen">
              <div className="card mini">
                <span>Ingresos</span>
                <strong className="pos">{soles(totalIngresos)}</strong>
              </div>
              <div className="card mini">
                <span>Egresos</span>
                <strong className="neg">{soles(totalEgresos)}</strong>
              </div>
              <div className="card mini">
                <span>Balance</span>
                <strong>{soles(totalIngresos - totalEgresos)}</strong>
              </div>
            </div>

            {egresos.length === 0 ? (
              <p className="vacio">No hay egresos en este periodo.</p>
            ) : (
              <>
                <div className="card">
                  <h3>¿En qué categoría gasté?</h3>
                  <div className="grafico">
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie
                          data={porCategoria}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={55}
                          outerRadius={95}
                          paddingAngle={2}
                        >
                          {porCategoria.map((_, i) => (
                            <Cell key={i} fill={COLORES[i % COLORES.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v) => soles(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <ul className="leyenda">
                    {porCategoria.map((c, i) => (
                      <li key={c.name}>
                        <i style={{ background: COLORES[i % COLORES.length] }} />
                        <span>{c.name}</span>
                        <strong>{soles(c.value)}</strong>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="card">
                  <h3>Gasto por categoría</h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={porCategoria} margin={{ left: -10, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => soles(v)} />
                      <Bar dataKey="value" name="Gasto" radius={[6, 6, 0, 0]}>
                        {porCategoria.map((_, i) => (
                          <Cell key={i} fill={COLORES[i % COLORES.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="card">
                  <h3>Por tipo de gasto</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={porTipoGasto} margin={{ left: -10, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => soles(v)} />
                      <Bar dataKey="value" name="Gasto" fill="#d97706" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="card">
                  <h3>Por medio de pago</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={porMedio} margin={{ left: -10, right: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => soles(v)} />
                      <Bar dataKey="value" name="Gasto" fill="#2563eb" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </section>
        )}
      </main>

      <nav className="tabs">
        <button className={vista === 'nuevo' ? 'activo' : ''} onClick={() => setVista('nuevo')}>
          <span>＋</span>Registrar
        </button>
        <button className={vista === 'historial' ? 'activo' : ''} onClick={() => setVista('historial')}>
          <span>☰</span>Historial
        </button>
        <button className={vista === 'dashboard' ? 'activo' : ''} onClick={() => setVista('dashboard')}>
          <span>◔</span>Panel
        </button>
      </nav>
    </div>
  )
}
