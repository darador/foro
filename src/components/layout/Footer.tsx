import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-[var(--border-color)] bg-[var(--bg-nav)] py-10 text-[var(--text-secondary)] text-xs transition-colors duration-200">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col gap-1.5 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2">
              <span className="font-bold text-[var(--text-primary)] text-sm">
                Foro<span className="text-[var(--pink-primary)]">Fetiche</span>
              </span>
              <span className="rounded-md border border-[var(--border-color)] bg-[var(--bg-secondary)] px-1.5 py-0.5 text-[9px] font-semibold text-[var(--pink-primary)]">
                18+
              </span>
            </div>
            <p className="text-[var(--text-muted)] max-w-md">
              Comunidad adulta especializada para conversar sin prejuicios sobre sexualidad, fetiches y deseos. Privacidad y consentimiento prioritarios.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-6 text-[var(--text-secondary)]">
            <Link href="/reglas" className="hover:text-[var(--text-primary)] transition">
              Reglas de convivencia
            </Link>
            <Link href="/privacidad" className="hover:text-[var(--text-primary)] transition">
              Privacidad y datos
            </Link>
            <Link href="/terminos" className="hover:text-[var(--text-primary)] transition">
              Términos de servicio
            </Link>
          </div>
        </div>

        <div className="mt-8 border-t border-[var(--border-color)] pt-5 text-center text-[var(--text-muted)] text-[11px]">
          © {new Date().getFullYear()} ForoFetiche. Todos los derechos reservados. Acceso exclusivo para personas adultas mayores de 18 años.
        </div>
      </div>
    </footer>
  );
}
