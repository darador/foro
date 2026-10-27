import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-[#2A2930] bg-[#09090B] py-10 text-[#AAA4B0] text-xs">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col gap-1.5 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2">
              <span className="font-bold text-[#F5F2F5] text-sm">
                Foro<span className="bg-gradient-to-r from-[#B23D66] to-[#967EFF] bg-clip-text text-transparent">Fetiche</span>
              </span>
              <span className="rounded-md border border-[#852D4C]/40 bg-[#571F35]/20 px-1.5 py-0.2 text-[9px] font-semibold text-[#FFB6CF]">
                18+
              </span>
            </div>
            <p className="text-[#726D7A] max-w-md">
              Comunidad adulta especializada para conversar sin prejuicios sobre sexualidad, fetiches y deseos. Privacidad y consentimiento prioritarios.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-6 text-[#AAA4B0]">
            <Link href="/reglas" className="hover:text-[#F5F2F5] transition">
              Reglas de convivencia
            </Link>
            <Link href="/privacidad" className="hover:text-[#F5F2F5] transition">
              Privacidad y datos
            </Link>
            <Link href="/terminos" className="hover:text-[#F5F2F5] transition">
              Términos de servicio
            </Link>
          </div>
        </div>

        <div className="mt-8 border-t border-[#1E1D24] pt-5 text-center text-[#726D7A] text-[11px]">
          © {new Date().getFullYear()} ForoFetiche. Todos los derechos reservados. Acceso exclusivo para personas adultas mayores de 18 años.
        </div>
      </div>
    </footer>
  );
}
