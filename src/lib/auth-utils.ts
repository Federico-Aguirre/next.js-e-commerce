import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';

// Llave secreta local para firmar los tokens (en producción iría en tu .env.local)
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'llave-secreta-ultra-segura-de-32-caracteres-minimo'
);

// 1. Encriptar contraseña de forma segura
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

// 2. Comparar contraseña ingresada con la encriptada en la base de datos
export async function comparePassword(password: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(password, hashed);
}

// 3. Crear Token de Sesión JWT válido por 7 días
export async function createSessionToken(payload: { userId: string; email: string }): Promise<string> {
  // 🚀 ARREGLADO: Forzamos el objeto como un Record plano para que 'jose' lo acepte sin chistar
  const claims: Record<string, string> = {
    userId: payload.userId,
    email: payload.email
  };

  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
}

// 4. Verificar Token JWT recibido desde las cookies
export async function verifySessionToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload;
  } catch {
    return null;
  }
}