import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-zinc-800 bg-zinc-950 py-8 text-zinc-400 text-xs">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-col gap-1 text-center md:text-left">
            <span className="font-semibold text-zinc-300">ForoFetiche</span>
            <p className="text-zinc-500">
              Comunidad anónima y discreta para adultos (+18) sobre sexualidad y fetiches.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-6 text-zinc-400">
            <Link href="/reglas" className="hover:text-zinc-200 transition">
              Reglas de la comunidad
            </Link>
            <Link href="/privacidad" className="hover:text-zinc-200 transition">
              Privacidad
            </Link>
            <Link href="/terminos" className="hover:text-zinc-200 transition">
              Términos de servicio
            </Link>
          </div>
        </div>

        <div className="mt-6 border-t border-zinc-900 pt-4 text-center text-zinc-600 text-[11px]">
          © {new Date().getFullYear()} ForoFetiche. Todos los derechos reservados. Acceso exclusivo para mayores de 18 años.
        </div>
      </div>
    </footer>
  );
}
