import { Search, Tag, Filter } from 'lucide-react';

export default function ExplorarPage() {
  const categories = [
    { name: 'Fetiches', slug: 'fetiches', count: 124 },
    { name: 'BDSM', slug: 'bdsm', count: 89 },
    { name: 'Swinger', slug: 'swinger', count: 65 },
    { name: 'Parejas', slug: 'parejas', count: 142 },
    { name: 'Encuentros', slug: 'encuentros', count: 98 },
    { name: 'Escorts', slug: 'escorts', count: 45 },
    { name: 'Lugares y eventos', slug: 'lugares-y-eventos', count: 32 },
    { name: 'Otros', slug: 'otros', count: 78 },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Explorar Comunidad</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Busca por palabras clave, explora por categorías o descubre tendencias.
        </p>
      </div>

      {/* Search Input Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-3.5 h-5 w-5 text-zinc-500" />
        <input
          type="text"
          placeholder="Buscar experiencias, preguntas, confesiones o tags..."
          className="w-full rounded-xl border border-zinc-800 bg-zinc-900/80 py-3 pl-12 pr-4 text-sm text-zinc-100 placeholder-zinc-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {/* Categories Grid */}
      <div>
        <h2 className="text-sm font-semibold text-zinc-300 mb-4 flex items-center gap-2">
          <Tag className="h-4 w-4 text-indigo-400" />
          Categorías principales
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {categories.map((cat) => (
            <div
              key={cat.slug}
              className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 hover:border-zinc-700 hover:bg-zinc-800/60 transition cursor-pointer"
            >
              <div className="text-sm font-medium text-zinc-200">{cat.name}</div>
              <div className="text-xs text-zinc-500 mt-1">{cat.count} publicaciones</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
