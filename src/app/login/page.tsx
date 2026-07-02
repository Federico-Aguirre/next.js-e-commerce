'use client';

import React, { useState } from 'react';
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState<boolean>(true);
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    // =========================================================================
    // FLUJO DE REGISTRO
    // =========================================================================
    if (!isLogin) {
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Ocurrió un error inesperado');
        }

        // Si el registro fue exitoso en Aiven, disparamos el inicio de sesión automático
        const result = await signIn("credentials", {
          redirect: false,
          email,
          password,
          callbackUrl: "/"
        });

        if (result?.error) {
          setErrorMsg(result.error === "CredentialsSignin" ? "Usuario creado, pero hubo un error al iniciar sesión automáticamente." : result.error);
          setIsLogin(true); // Fallback por si acaso para que intente manual
        } else {
          alert('¡Cuenta creada e inicio de sesión exitoso!');
          router.push("/");
          router.refresh();
        }
      } catch (err: unknown) {
        if (err instanceof Error) setErrorMsg(err.message);
      } finally {
        setLoading(false);
      }
      return;
    }

    // =========================================================================
    // FLUJO DE LOGIN TRADICIONAL
    // =========================================================================
    try {
      const result = await signIn("credentials", {
        redirect: false,
        email,
        password,
        callbackUrl: "/"
      });

      if (result?.error) {
        setErrorMsg(result.error === "CredentialsSignin" ? "Credenciales inválidas" : result.error);
      } else {
        alert('¡Inicio de sesión exitoso!');
        router.push("/");
        router.refresh();
      }
    } catch {
      setErrorMsg('Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      await signIn("google", { callbackUrl: "/?login=success" });
    } catch {
      setErrorMsg("Ocurrió un error inesperado con Google");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="text-center text-3xl font-black tracking-tight text-gray-900">
          {isLogin ? 'Iniciar sesión' : 'Crear cuenta'}
        </h2>
        <p className="mt-2 text-center text-sm text-gray-500">
          O{' '}
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setErrorMsg(null);
            }}
            className="font-bold text-indigo-600 hover:text-indigo-500 transition-colors underline focus:outline-none"
          >
            {isLogin ? 'regístrate si no tienes usuario' : 'inicia sesión si ya eres miembro'}
          </button>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-sm border border-gray-100 sm:rounded-2xl sm:px-10">
          
          {errorMsg && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-md text-sm text-red-700 font-medium">
              ⚠️ {errorMsg}
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            {!isLogin && (
              <div>
                <label htmlFor="name" className="block text-sm font-bold text-gray-700 uppercase tracking-wider text-[11px]">
                  Nombre Completo
                </label>
                <div className="mt-1">
                  <input
                    id="name"
                    type="text"
                    required={!isLogin}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="appearance-none block w-full px-3 py-3 border border-gray-200 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-gray-50/50"
                    placeholder="John Doe"
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-bold text-gray-700 uppercase tracking-wider text-[11px]">
                Correo Electrónico
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full px-3 py-3 border border-gray-200 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-gray-50/50"
                  placeholder="senior@store.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-bold text-gray-700 uppercase tracking-wider text-[11px]">
                Contraseña
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-3 py-3 border border-gray-200 rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm bg-gray-50/50"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-gray-900 border border-transparent rounded-lg flex items-center justify-center text-sm font-bold text-white shadow-md hover:bg-indigo-600 transition-colors shadow-gray-900/10 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Procesando...' : isLogin ? 'Iniciar sesión' : 'Crear cuenta'}
              </button>
            </div>
            
            <div className="mt-6">
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">O continúa con</span>
                </div>
              </div>

              <div className="mt-6">
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleGoogleLogin}
                  className="w-full h-12 flex items-center justify-center gap-3 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-700 shadow-sm hover:bg-gray-50 transition-colors focus:outline-none disabled:opacity-50"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#EA4335"
                      d="M12.24 10.285V14.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.866-3.577-7.866-8s3.536-8 7.866-8c2.46 0 4.105 1.025 5.047 1.926l3.227-3.1A12.7 12.7 0 0012.24 0C5.58 0 0 5.37 0 12s5.58 12 12.24 12c6.96 0 11.57-4.84 11.57-11.64 0-.787-.08-1.39-.183-2.075H12.24z"
                    />
                  </svg>
                  Entrar con Google
                </button>
              </div>
            </div>
          </form>

        </div>
      </div>
    </main>
  );
}