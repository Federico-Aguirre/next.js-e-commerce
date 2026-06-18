import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true, message: 'Sesión cerrada' });
  
  // Borramos la cookie del navegador de forma segura
  response.cookies.delete('senior_session');
  
  return response;
}