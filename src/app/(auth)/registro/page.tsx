'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, Lock, AlertCircle, EyeOff, User, Mail, KeyRound, Sparkles } from 'lucide-react';
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
        'Cuenta creada exitosamente. Hemos enviado un correo de verificación a tu email para activar tu identidad.'
      );
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Error al registrar la cuenta.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative mx-auto max-w-lg px-4 py-12 sm:px-6 space-y-7 transition-colors duration-200">
      {/* Header Info */}
      <div className="relative z-10 text-center space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-1 text-xs font-semibold text-[var(--pink-primary)]">
          <Sparkles className="h-3.5 w-3.5" />
          <span>Comunidad Adulta Discreta (18+)</span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-4xl">
          Elegí tu identidad.
        </h1>
        <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-sm mx-auto leading-relaxed">
          Tu alias te representa en la comunidad. Conocé cómo protegemos tu privacidad.
        </p>
      </div>

      {error && (
        <div className="relative z-10 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-500 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="relative z-10 rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-xs text-emerald-600 dark:text-emerald-300 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="h-5 w-5" />
            <span>¡Verificación enviada!</span>
          </div>
          <p className="leading-relaxed text-[var(--text-secondary)]">{successMessage}</p>
          <div className="pt-2">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600/20 border border-emerald-500/30 px-4 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-200 hover:bg-emerald-600/30 transition"
            >
              Ir a Iniciar Sesión →
            </Link>
          </div>
        </div>
      )}

      {!successMessage && (
        <form
          onSubmit={handleSubmit}
          className="relative z-10 space-y-5 rounded-3xl border border-[var(--border-color)] bg-[var(--bg-card)] p-6 sm:p-8 shadow-sm transition-colors duration-200"
        >
          {/* Privacy Note Banner */}
          <div className="flex items-start gap-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-3.5 text-[11px] text-[var(--text-secondary)] leading-relaxed">
            <Lock className="h-4 w-4 text-[var(--pink-primary)] shrink-0 mt-0.5" />
            <div>
              <strong className="text-[var(--text-primary)] block mb-0.5">Protección de identidad</strong>
              Tu correo es confidencial y jamás se mostrará ante otros miembros. Tu alias es tu único identificador público.
            </div>
          </div>

          {/* Alias */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5 flex items-center justify-between">
              <span>Alias público</span>
              <span className="text-[11px] font-normal text-[var(--text-muted)]">Visible en el foro</span>
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-3 h-4 w-4 text-[var(--text-muted)]" />
              <input
                type="text"
                required
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                placeholder="ej. sombra_nocturna"
                className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] py-2.5 pl-10 pr-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--pink-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--violet-primary)] transition"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5 flex items-center justify-between">
              <span>Correo electrónico</span>
              <span className="text-[11px] font-normal text-[var(--pink-primary)]">Estrictamente privado</span>
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 h-4 w-4 text-[var(--text-muted)]" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] py-2.5 pl-10 pr-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--pink-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--violet-primary)] transition"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5">
              Contraseña
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3.5 top-3 h-4 w-4 text-[var(--text-muted)]" />
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] py-2.5 pl-10 pr-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--pink-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--violet-primary)] transition"
              />
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-xs font-semibold text-[var(--text-primary)] mb-1.5">
              Confirmar contraseña
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3.5 top-3 h-4 w-4 text-[var(--text-muted)]" />
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repetir contraseña"
                className="w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] py-2.5 pl-10 pr-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--pink-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--violet-primary)] transition"
              />
            </div>
          </div>

          {/* Mandatory Confirmations */}
          <div className="space-y-3 border-t border-[var(--border-color)] pt-4 text-xs text-[var(--text-secondary)]">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                required
                checked={isOver18}
                onChange={(e) => setIsOver18(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--pink-primary)] focus:ring-[var(--pink-primary)] accent-[var(--pink-primary)]"
              />
              <span className="text-[var(--text-primary)] font-semibold">
                Confirmo que tengo 18 años de edad o más.
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                required
                checked={acceptRules}
                onChange={(e) => setAcceptRules(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--pink-primary)] focus:ring-[var(--pink-primary)] accent-[var(--pink-primary)]"
              />
              <span>
                Acepto las{' '}
                <Link href="/reglas" target="_blank" className="text-[var(--pink-primary)] hover:underline font-semibold">
                  reglas de convivencia
                </Link>{' '}
                de la comunidad.
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                required
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--pink-primary)] focus:ring-[var(--pink-primary)] accent-[var(--pink-primary)]"
              />
              <span>
                Acepto los{' '}
                <Link href="/terminos" target="_blank" className="text-[var(--pink-primary)] hover:underline font-semibold">
                  Términos de Servicio
                </Link>.
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                required
                checked={acceptPrivacy}
                onChange={(e) => setAcceptPrivacy(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-[var(--border-color)] bg-[var(--bg-secondary)] text-[var(--pink-primary)] focus:ring-[var(--pink-primary)] accent-[var(--pink-primary)]"
              />
              <span>
                Acepto la{' '}
                <Link href="/privacidad" target="_blank" className="text-[var(--pink-primary)] hover:underline font-semibold">
                  Política de Privacidad
                </Link>.
              </span>
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-[var(--btn-gradient-from)] to-[var(--btn-gradient-to)] py-3 text-sm font-semibold text-white hover:opacity-95 transition-all shadow-md disabled:opacity-50"
          >
            {loading ? 'Creando identidad...' : 'Crear mi cuenta'}
          </button>

          <p className="text-center text-xs text-[var(--text-secondary)] pt-1">
            ¿Ya tenés una cuenta?{' '}
            <Link href="/login" className="text-[var(--pink-primary)] font-semibold hover:underline">
              Iniciar sesión
            </Link>
          </p>
        </form>
      )}
    </div>
  );
}
