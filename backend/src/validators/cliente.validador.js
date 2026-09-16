export function validarCliente(req, res, next) {
  const { nombre, apellido, dni, telefono } = req.body

  const errores = []

  if (!nombre || !nombre.trim()) {
    errores.push('El nombre es obligatorio')
  }

  if (!apellido || !apellido.trim()) {
    errores.push('El apellido es obligatorio')
  }

  if (dni && !/^\d{7,8}$/.test(dni)) {
    errores.push('El DNI debe tener 7 u 8 digitos')
  }

  if (telefono && !/^[0-9+\-\s()]{6,20}$/.test(telefono)) {
    errores.push('El telefono tiene un formato invalido')
  }

  if (errores.length > 0) {
    return res.status(400).json({ errores })
  }

  next()
}