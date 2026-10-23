// Foto de perfil redonda. Si no hay foto, muestra las iniciales del nombre.
export default function Avatar({ foto, nombre = '', apellido = '', tamano = 96, placeholderVacio = '?' }) {
  const iniciales = `${nombre.trim()[0] ?? ''}${apellido.trim()[0] ?? ''}`.toUpperCase() || placeholderVacio
  const estilo = { width: tamano, height: tamano, fontSize: tamano * 0.36 }

  return foto ? (
    <img className="avatar" src={foto} alt={`Foto de ${nombre} ${apellido}`.trim()} style={estilo} />
  ) : (
    <span className="avatar avatar-iniciales" style={estilo} aria-label="Sin foto de perfil">{iniciales}</span>
  )
}
