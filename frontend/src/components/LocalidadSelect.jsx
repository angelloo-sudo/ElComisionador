// Campo para elegir una localidad de la lista (combobox).
// Se puede abrir la lista completa con la flecha y recorrerla, o escribir para filtrar
// ("cor" -> Córdoba). Solo es valido si se elige una opcion:
// "value" solo tiene texto cuando coincide exactamente con una localidad de la lista.
import { useState, useMemo, useRef, useId, useEffect } from 'react'
import Icon from './Icon.jsx'

// Sin tildes ni mayusculas, para que "cordoba" encuentre "Córdoba".
function normalizar(texto) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

export default function LocalidadSelect({ label, value, onChange, localidades, deshabilitado, error, placeholder = 'Selecciona la localidad' }) {
  const id = useId()
  const [texto, setTexto] = useState(value ?? '')
  const [abierto, setAbierto] = useState(false)
  const [indiceActivo, setIndiceActivo] = useState(0)
  // Solo se filtra cuando la persona escribe; al abrir con la flecha se ve la lista completa.
  const [filtrando, setFiltrando] = useState(false)
  const inputRef = useRef(null)
  const listaRef = useRef(null)

  const normalizadas = useMemo(
    () => localidades.map((nombre) => ({ nombre, clave: normalizar(nombre) })),
    [localidades]
  )

  const opciones = useMemo(() => {
    const buscado = normalizar(texto)
    if (!filtrando || !buscado) return normalizadas
    const empiezan = []
    const contienen = []
    for (const o of normalizadas) {
      if (o.clave.startsWith(buscado)) empiezan.push(o)
      else if (o.clave.includes(buscado)) contienen.push(o)
    }
    return [...empiezan, ...contienen]
  }, [texto, filtrando, normalizadas])

  // Mantiene visible la opcion resaltada al moverse con el teclado en una lista larga.
  useEffect(() => {
    if (abierto) listaRef.current?.children[indiceActivo]?.scrollIntoView?.({ block: 'nearest' })
  }, [abierto, indiceActivo])

  // Abre la lista completa, parada en la opcion ya elegida (si hay una).
  function abrir() {
    setFiltrando(false)
    const actual = normalizadas.findIndex((o) => o.nombre === value)
    setIndiceActivo(actual >= 0 ? actual : 0)
    setAbierto(true)
  }

  function alternar() {
    if (abierto) setAbierto(false)
    else { abrir(); inputRef.current?.focus() }
  }

  // Mientras no haya una opcion elegida, el campo avisa que falta (validacion nativa del form).
  useEffect(() => {
    inputRef.current?.setCustomValidity(value ? '' : 'Elegí una localidad de la lista')
  }, [value])

  function elegir(nombre) {
    setTexto(nombre)
    onChange(nombre)
    setFiltrando(false)
    setAbierto(false)
  }

  function handleChange(e) {
    const nuevo = e.target.value
    setTexto(nuevo)
    setFiltrando(true)
    setAbierto(true)
    setIndiceActivo(0)
    // Si lo escrito coincide exacto con una localidad, queda elegida; si no, se limpia.
    const exacta = localidades.find((l) => normalizar(l) === normalizar(nuevo))
    onChange(exacta ?? '')
    if (exacta) setTexto(exacta)
  }

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!abierto) { abrir(); return }
      setIndiceActivo((i) => Math.min(i + 1, opciones.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setIndiceActivo((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && abierto && opciones[indiceActivo]) {
      e.preventDefault() // no enviar el formulario: solo elegir la opcion
      elegir(opciones[indiceActivo].nombre)
    } else if (e.key === 'Escape') {
      setAbierto(false)
    }
  }

  function handleBlur() {
    setAbierto(false)
    setFiltrando(false)
    // Al salir del campo, si no se eligio nada valido, se deja el texto como esta
    // (el form marca el error); si habia una eleccion, se muestra completa.
    if (value) setTexto(value)
  }

  return (
    <div className="campo localidad-select">
      <label htmlFor={id}>{label}<span className="req">*</span></label>
      <div className={`input-wrap${error ? ' tiene-error' : ''}`}>
        <Icon nombre="pin" />
        <input
          id={id}
          ref={inputRef}
          value={texto}
          onChange={handleChange}
          onFocus={abrir}
          onClick={() => { if (!abierto) abrir() }}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={abierto}
          aria-controls={`${id}-lista`}
          aria-autocomplete="list"
          disabled={deshabilitado}
          required
        />
        <button
          type="button"
          className="localidad-flecha"
          tabIndex={-1}
          aria-label="Mostrar todas las localidades"
          disabled={deshabilitado}
          onMouseDown={(e) => e.preventDefault()}
          onClick={alternar}
        >
          <Icon nombre="down" />
        </button>
      </div>
      {error && <p className="campo-error"><Icon nombre="alert" tamano={16} />{error}</p>}
      {abierto && (
        <ul id={`${id}-lista`} role="listbox" className="localidad-opciones" ref={listaRef}>
          {opciones.length === 0 ? (
            <li className="sin-resultados">No hay localidades que coincidan</li>
          ) : (
            opciones.map((o, i) => (
              <li
                key={o.nombre}
                role="option"
                aria-selected={i === indiceActivo}
                className={i === indiceActivo ? 'activa' : ''}
                // onMouseDown (y no onClick) para elegir antes de que el input pierda el foco
                onMouseDown={(e) => { e.preventDefault(); elegir(o.nombre) }}
                onMouseEnter={() => setIndiceActivo(i)}
              >
                {o.nombre}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
