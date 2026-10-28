'use client';

import { useRouter } from 'next/navigation';
import { MapPin } from 'lucide-react';

interface LocationFilterProps {
  currentLocation: string;
  baseUrl: string;
}

const LOCATIONS = [
  { id: '', label: 'Todo el país' },
  { id: 'CABA', label: 'CABA' },
  { id: 'GBA Norte', label: 'GBA Norte' },
  { id: 'GBA Sur', label: 'GBA Sur' },
  { id: 'GBA Oeste', label: 'GBA Oeste' },
  { id: 'La Plata', label: 'La Plata' },
  { id: 'Córdoba', label: 'Córdoba' },
  { id: 'Rosario y Santa Fe', label: 'Rosario y Santa Fe' },
  { id: 'Mendoza', label: 'Mendoza' },
  { id: 'Otras localidades', label: 'Otras localidades' },
];

export function LocationFilter({ currentLocation, baseUrl }: LocationFilterProps) {
  const router = useRouter();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    const url = new URL(baseUrl, window.location.origin);

    if (value) {
      url.searchParams.set('ubicacion', value);
    } else {
      url.searchParams.delete('ubicacion');
    }
    url.searchParams.set('page', '1');

    router.push(url.pathname + url.search);
  };

  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className="text-[#62596C] dark:text-zinc-500 flex items-center gap-1 font-medium whitespace-nowrap">
        <MapPin className="h-3.5 w-3.5 text-[#777080] dark:text-zinc-400" />
        <span>Ubicación:</span>
      </span>
      <select
        value={currentLocation}
        onChange={handleChange}
        aria-label="Filtrar por ubicación geográfica"
        className="rounded-lg border border-[#E3DDE9] bg-white px-2.5 py-1 text-xs font-medium text-[#211B29] transition-all duration-150 focus:border-[#8B5CF6] focus:outline-none focus:ring-1 focus:ring-[#8B5CF6]/30 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 cursor-pointer shadow-none"
      >
        {LOCATIONS.map((loc) => (
          <option key={loc.id} value={loc.id} className="dark:bg-zinc-900 dark:text-zinc-100">
            {loc.label}
          </option>
        ))}
      </select>
    </div>
  );
}
