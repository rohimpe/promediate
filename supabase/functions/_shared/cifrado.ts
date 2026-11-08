// Cifrado AES-GCM del refresh token. La clave (32 bytes en base64) es el secret
// TOKEN_ENCRYPTION_KEY. Lo que se guarda en la base es base64( IV de 12 bytes + texto cifrado ).
// AES-GCM además detecta si alguien modificó el texto cifrado: descifrar falla en ese caso.

const BYTES_IV = 12

function aBytes(base64: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
}

function aBase64(bytes: Uint8Array): string {
  let texto = ''
  for (const b of bytes) texto += String.fromCharCode(b)
  return btoa(texto)
}

async function importarClave(): Promise<CryptoKey> {
  const base64 = Deno.env.get('TOKEN_ENCRYPTION_KEY')
  if (!base64) throw new Error('Falta TOKEN_ENCRYPTION_KEY')
  const bytes = aBytes(base64)
  if (bytes.length !== 32) throw new Error('TOKEN_ENCRYPTION_KEY debe tener 32 bytes')
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export async function cifrar(textoPlano: string): Promise<string> {
  const clave = await importarClave()
  // Un IV nuevo y aleatorio por cada cifrado: nunca se reutiliza con la misma clave.
  const iv = crypto.getRandomValues(new Uint8Array(BYTES_IV))
  const cifrado = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, clave, new TextEncoder().encode(textoPlano)),
  )
  const salida = new Uint8Array(BYTES_IV + cifrado.length)
  salida.set(iv)
  salida.set(cifrado, BYTES_IV)
  return aBase64(salida)
}

export async function descifrar(guardado: string): Promise<string> {
  const clave = await importarClave()
  const bytes = aBytes(guardado)
  const iv = bytes.slice(0, BYTES_IV)
  const cifrado = bytes.slice(BYTES_IV)
  const plano = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, clave, cifrado)
  return new TextDecoder().decode(plano)
}
