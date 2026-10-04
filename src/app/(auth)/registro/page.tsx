'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, Lock, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function RegistroPage() {
  const [alias, setAlias] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isOver18, setIsOver18] = useState(false);
  const [acceptRules, setAcceptRules] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    if (!isOver18 || !acceptRules || !acceptTerms || !acceptPrivacy) {
      setError('Debes confirmar ser mayor de 18 años y aceptar los términos y privacidad.');
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            alias,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (signUpError) {
        throw signUpError;
      }

      setSuccessMessage(
        'Cuenta creada exitosamente. Hemos enviado un correo de verificación a tu email.'
      );
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error al registrar la cuenta.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:px-6 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-zinc-100">Crear cuenta anónima</h1>
        <p className="text-xs text-zinc-400">
          Tu e-mail nunca será visible públicamente. Tu identidad pública es tu alias.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-300 space-y-2">
          <div className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            ¡Verificación requerida!
          </div>
          <p>{successMessage}</p>
          <div className="pt-2">
            <Link
              href="/login"
              className="text-xs font-semibold text-emerald-400 underline hover:text-emerald-300"
            >
              Ir a Iniciar Sesión
            </Link>
          </div>
        </div>
      )}

      {!successMessage && (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl backdrop-blur-sm">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">
              Alias público (único)
            </label>
            <input
              type="text"
              required
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder="ej. sombra_nocturna"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-indigo-500 focus:outline-none"
            />
            <p className="text-[11px] text-zinc-500 mt-1">Este será tu único nombre visible en el foro.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">
              Correo electrónico (Privado)
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">
              Contraseña
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">
              Confirmar contraseña
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* Mandatory Confirmations (Section 9) */}
          <div className="space-y-2 border-t border-zinc-800 pt-4 text-xs text-zinc-400">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                required
                checked={isOver18}
                onChange={(e) => setIsOver18(e.target.checked)}
                className="mt-0.5 rounded border-zinc-700 bg-zinc-950 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Confirmo que tengo 18 años de edad o más.</span>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                required
                checked={acceptRules}
                onChange={(e) => setAcceptRules(e.target.checked)}
                className="mt-0.5 rounded border-zinc-700 bg-zinc-950 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Acepto las reglas de convivencia de la comunidad.</span>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                required
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="mt-0.5 rounded border-zinc-700 bg-zinc-950 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Acepto los Términos de Servicio.</span>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                required
                checked={acceptPrivacy}
                onChange={(e) => setAcceptPrivacy(e.target.checked)}
                className="mt-0.5 rounded border-zinc-700 bg-zinc-950 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Acepto la Política de Privacidad.</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 transition shadow disabled:opacity-50"
          >
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>

          <p className="text-center text-xs text-zinc-500 pt-2">
            ¿Ya tienes una cuenta?{' '}
            <Link href="/login" className="text-indigo-400 hover:underline">
              Iniciar sesión
            </Link>
          </p>
        </form>
      )}
    </div>
  );
}
