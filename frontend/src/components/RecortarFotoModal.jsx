// Ajuste de la foto de perfil: la persona elige una foto y, antes de guardarla, la acomoda
// dentro del círculo arrastrándola y acercándola con el control de zoom.
import { useEffect, useRef, useState } from 'react'
import { Alerta, Modal } from './ui.jsx'
import Icon from './Icon.jsx'
import { recortarFotoPerfil } from '../utils/imagen.js'

const ZOOM_MAXIMO = 4

export default function RecortarFotoModal({ archivo, onListo, onCancelar }) {
  const marcoRef = useRef(null)
  const imagenRef = useRef(null)
  const arrastreRef = useRef(null)
  const [url, setUrl] = useState(null)
  const [natural, setNatural] = useState(null) // { ancho, alto } de la imagen original
  const [marco, setMarco] = useState(280) // lado del círculo en pantalla
  const [zoom, setZoom] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 }) // desplazamiento de la imagen dentro del círculo
  const [error, setError] = useState('')

  useEffect(() => {
    const nueva = URL.createObjectURL(archivo)
    setUrl(nueva)
    return () => URL.revokeObjectURL(nueva)
  }, [archivo])

  // Escala para que la imagen cubra el círculo con zoom 1 (como "object-fit: cover").
  const escalaBase = natural ? marco / Math.min(natural.ancho, natural.alto) : 1
  const escala = escalaBase * zoom
  const anchoVisible = natural ? natural.ancho * escala : 0
  const altoVisible = natural ? natural.alto * escala : 0

  // La imagen nunca deja huecos dentro del círculo.
  const limitar = (p, ancho = anchoVisible, alto = altoVisible) => ({
    x: Math.min(0, Math.max(marco - ancho, p.x)),
    y: Math.min(0, Math.max(marco - alto, p.y)),
  })

  function alCargar() {
    const img = imagenRef.current
    const lado = marcoRef.current?.clientWidth || 280
    const base = lado / Math.min(img.naturalWidth, img.naturalHeight)
    setMarco(lado)
    setNatural({ ancho: img.naturalWidth, alto: img.naturalHeight })
    setZoom(1)
    // Arranca centrada.
    setPos({ x: (lado - img.naturalWidth * base) / 2, y: (lado - img.naturalHeight * base) / 2 })
  }

  // Al hacer zoom se mantiene fijo el punto del centro del círculo.
  function cambiarZoom(nuevo) {
    if (!natural) return
    const z = Math.min(ZOOM_MAXIMO, Math.max(1, nuevo))
    const escalaNueva = escalaBase * z
    const centroX = (marco / 2 - pos.x) / escala
    const centroY = (marco / 2 - pos.y) / escala
    setZoom(z)
    setPos(limitar(
      { x: marco / 2 - centroX * escalaNueva, y: marco / 2 - centroY * escalaNueva },
      natural.ancho * escalaNueva,
      natural.alto * escalaNueva,
    ))
  }

  function empezarArrastre(evento) {
    if (!natural) return
    evento.currentTarget.setPointerCapture(evento.pointerId)
    arrastreRef.current = { x: evento.clientX, y: evento.clientY, inicio: pos }
  }

  function arrastrar(evento) {
    const a = arrastreRef.current
    if (!a) return
    setPos(limitar({ x: a.inicio.x + evento.clientX - a.x, y: a.inicio.y + evento.clientY - a.y }))
  }

  function terminarArrastre() {
    arrastreRef.current = null
  }

  function moverConTeclado(evento) {
    const paso = evento.shiftKey ? 20 : 6
    const movimientos = { ArrowLeft: [paso, 0], ArrowRight: [-paso, 0], ArrowUp: [0, paso], ArrowDown: [0, -paso] }
    if (movimientos[evento.key]) {
      evento.preventDefault()
      const [dx, dy] = movimientos[evento.key]
      setPos((p) => limitar({ x: p.x + dx, y: p.y + dy }))
    } else if (evento.key === '+' || evento.key === '=') cambiarZoom(zoom + 0.1)
    else if (evento.key === '-') cambiarZoom(zoom - 0.1)
  }

  function confirmar() {
    try {
      const foto = recortarFotoPerfil(imagenRef.current, { sx: -pos.x / escala, sy: -pos.y / escala, lado: marco / escala })
      onListo(foto)
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <Modal onClose={onCancelar} cerrarAlClickFuera={false}>
      <h2>Ajustá tu foto</h2>
      <p>Arrastrá la imagen para acomodarla dentro del círculo y usá el zoom para acercarla.</p>
      {error && <Alerta tipo="error" titulo="No se pudo usar la foto">{error}</Alerta>}
      <div className="recorte-foto">
        <div
          ref={marcoRef}
          className="recorte-foto-marco"
          tabIndex={0}
          role="application"
          aria-label="Vista previa de la foto. Usá las flechas para moverla y + o - para el zoom"
          onPointerDown={empezarArrastre}
          onPointerMove={arrastrar}
          onPointerUp={terminarArrastre}
          onPointerCancel={terminarArrastre}
          onWheel={(e) => cambiarZoom(zoom + (e.deltaY < 0 ? 0.1 : -0.1))}
          onKeyDown={moverConTeclado}
        >
          {url && (
            <img
              ref={imagenRef}
              src={url}
              alt=""
              draggable={false}
              onLoad={alCargar}
              onError={() => setError('No se pudo leer la imagen. Probá con otra foto.')}
              style={natural ? { width: anchoVisible, height: altoVisible, transform: `translate(${pos.x}px, ${pos.y}px)` } : { opacity: 0 }}
            />
          )}
        </div>
        <label className="recorte-foto-zoom">
          <Icon nombre="minus" tamano={16} />
          <input type="range" min="1" max={ZOOM_MAXIMO} step="0.01" value={zoom} onChange={(e) => cambiarZoom(Number(e.target.value))} aria-label="Zoom de la foto" disabled={!natural} />
          <Icon nombre="plus" tamano={16} />
        </label>
      </div>
      <div className="modal-acciones">
        <button type="button" className="btn" onClick={onCancelar}>Cancelar</button>
        <button type="button" className="btn btn-primario" onClick={confirmar} disabled={!natural}><Icon nombre="check" tamano={16} /> Usar esta foto</button>
      </div>
    </Modal>
  )
}
