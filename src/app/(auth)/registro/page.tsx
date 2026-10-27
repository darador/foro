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
    <div className="relative mx-auto max-w-lg px-4 py-12 sm:px-6 space-y-7">
      {/* Ambient Glows */}
      <div className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 h-72 w-72 rounded-full bg-gradient-to-b from-[#852D4C]/25 to-[#7553FF]/15 blur-3xl" />

      {/* Header Info */}
      <div className="relative z-10 text-center space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#852D4C]/40 bg-[#571F35]/25 px-3 py-1 text-xs font-medium text-[#FFB6CF]">
          <Sparkles className="h-3.5 w-3.5 text-[#FFB6CF]" />
          <span>Comunidad Adulta Discreta (18+)</span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-[#F5F2F5] sm:text-4xl">
          Elegí tu identidad.
        </h1>
        <p className="text-xs sm:text-sm text-[#AAA4B0] max-w-sm mx-auto leading-relaxed">
          Tu alias te representa en la comunidad. Conocé cómo protegemos tu privacidad.
        </p>
      </div>

      {error && (
        <div className="relative z-10 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-200 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="relative z-10 rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-xs text-emerald-200 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-emerald-300">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            ¡Verificación enviada!
          </div>
          <p className="leading-relaxed text-[#D6D0DC]">{successMessage}</p>
          <div className="pt-2">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600/30 border border-emerald-500/40 px-4 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-600/40 transition"
            >
              Ir a Iniciar Sesión →
            </Link>
          </div>
        </div>
      )}

      {!successMessage && (
        <form
          onSubmit={handleSubmit}
          className="relative z-10 space-y-5 rounded-3xl border border-[#2A2930] bg-[#111114]/90 p-6 sm:p-8 shadow-[0_20px_50px_rgba(9,9,11,0.8)] backdrop-blur-xl"
        >
          {/* Privacy Note Banner */}
          <div className="flex items-start gap-3 rounded-2xl border border-[#2A2930] bg-[#18181D]/70 p-3.5 text-[11px] text-[#AAA4B0] leading-relaxed">
            <Lock className="h-4 w-4 text-[#FFB6CF] shrink-0 mt-0.5" />
            <div>
              <strong className="text-[#F5F2F5] block mb-0.5">Protección de identidad</strong>
              Tu correo es confidencial y jamás se mostrará ante otros miembros. Tu alias es tu único identificador público.
            </div>
          </div>

          {/* Alias */}
          <div>
            <label className="block text-xs font-semibold text-[#F5F2F5] mb-1.5 flex items-center justify-between">
              <span>Alias público</span>
              <span className="text-[11px] font-normal text-[#726D7A]">Visible en el foro</span>
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-3 h-4 w-4 text-[#726D7A]" />
              <input
                type="text"
                required
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                placeholder="ej. sombra_nocturna"
                className="w-full rounded-xl border border-[#2A2930] bg-[#18181D] py-2.5 pl-10 pr-3 text-sm text-[#F5F2F5] placeholder-[#726D7A] focus:border-[#7553FF] focus:outline-none focus:ring-1 focus:ring-[#7553FF] transition"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-[#F5F2F5] mb-1.5 flex items-center justify-between">
              <span>Correo electrónico</span>
              <span className="text-[11px] font-normal text-[#FFB6CF]">Estrictamente privado</span>
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 h-4 w-4 text-[#726D7A]" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="w-full rounded-xl border border-[#2A2930] bg-[#18181D] py-2.5 pl-10 pr-3 text-sm text-[#F5F2F5] placeholder-[#726D7A] focus:border-[#7553FF] focus:outline-none focus:ring-1 focus:ring-[#7553FF] transition"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold text-[#F5F2F5] mb-1.5">
              Contraseña
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3.5 top-3 h-4 w-4 text-[#726D7A]" />
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                className="w-full rounded-xl border border-[#2A2930] bg-[#18181D] py-2.5 pl-10 pr-3 text-sm text-[#F5F2F5] placeholder-[#726D7A] focus:border-[#7553FF] focus:outline-none focus:ring-1 focus:ring-[#7553FF] transition"
              />
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-xs font-semibold text-[#F5F2F5] mb-1.5">
              Confirmar contraseña
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3.5 top-3 h-4 w-4 text-[#726D7A]" />
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repetir contraseña"
                className="w-full rounded-xl border border-[#2A2930] bg-[#18181D] py-2.5 pl-10 pr-3 text-sm text-[#F5F2F5] placeholder-[#726D7A] focus:border-[#7553FF] focus:outline-none focus:ring-1 focus:ring-[#7553FF] transition"
              />
            </div>
          </div>

          {/* Mandatory Confirmations */}
          <div className="space-y-3 border-t border-[#2A2930] pt-4 text-xs text-[#AAA4B0]">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                required
                checked={isOver18}
                onChange={(e) => setIsOver18(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-[#2A2930] bg-[#18181D] text-[#852D4C] focus:ring-[#852D4C] accent-[#852D4C]"
              />
              <span className="text-[#F5F2F5] font-medium">
                Confirmo que tengo 18 años de edad o más.
              </span>
            </label>

            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                required
                checked={acceptRules}
                onChange={(e) => setAcceptRules(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-[#2A2930] bg-[#18181D] text-[#852D4C] focus:ring-[#852D4C] accent-[#852D4C]"
              />
              <span>
                Acepto las{' '}
                <Link href="/reglas" target="_blank" className="text-[#967EFF] hover:underline font-medium">
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
                className="mt-0.5 h-4 w-4 rounded border-[#2A2930] bg-[#18181D] text-[#852D4C] focus:ring-[#852D4C] accent-[#852D4C]"
              />
              <span>
                Acepto los{' '}
                <Link href="/terminos" target="_blank" className="text-[#967EFF] hover:underline font-medium">
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
                className="mt-0.5 h-4 w-4 rounded border-[#2A2930] bg-[#18181D] text-[#852D4C] focus:ring-[#852D4C] accent-[#852D4C]"
              />
              <span>
                Acepto la{' '}
                <Link href="/privacidad" target="_blank" className="text-[#967EFF] hover:underline font-medium">
                  Política de Privacidad
                </Link>.
              </span>
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-[#852D4C] to-[#7553FF] py-3 text-sm font-semibold text-white hover:from-[#9C3559] hover:to-[#8565FF] transition-all shadow-[0_4px_20px_rgba(133,45,76,0.25)] hover:shadow-[0_6px_25px_rgba(133,45,76,0.4)] disabled:opacity-50"
          >
            {loading ? 'Creando identidad...' : 'Crear mi cuenta'}
          </button>

          <p className="text-center text-xs text-[#AAA4B0] pt-1">
            ¿Ya tenés una cuenta?{' '}
            <Link href="/login" className="text-[#967EFF] font-semibold hover:underline">
              Iniciar sesión
            </Link>
          </p>
        </form>
      )}
    </div>
  );
}
