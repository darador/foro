'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, PlusCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { createPost } from '@/lib/services/client/posts';
import type { PostType } from '@/types/database';

export default function PublicarPage() {
  const [type, setType] = useState<PostType>('EXPERIENCE');
  const [categoryId, setCategoryId] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [user, setUser] = useState<{ id: string; email_verified?: boolean } | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();

  useEffect(() => {
    async function loadInitialData() {
      try {
        const supabase = createClient();
        const { data: authData } = await supabase.auth.getUser();

        if (authData?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, email_verified')
            .eq('id', authData.user.id)
            .single();

          setUser(profile);
        }

        const { data: cats } = await supabase.from('categories').select('id, name').order('name');
        if (cats) {
          setCategories(cats);
          if (cats.length > 0) setCategoryId(cats[0].id);
        }
      } catch {
        // Fallback
      } finally {
        setLoadingUser(false);
      }
    }

    loadInitialData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user) {
      setError('Debes iniciar sesión para publicar.');
      return;
    }

    if (user.email_verified === false) {
      setError('Debes verificar tu correo electrónico para poder crear publicaciones.');
      return;
    }

    if (!title.trim() || title.trim().length < 5) {
      setError('El título debe tener al menos 5 caracteres.');
      return;
    }

    if (!content.trim() || content.trim().length < 20) {
      setError('El contenido debe tener al menos 20 caracteres.');
      return;
    }

    if (!categoryId) {
      setError('Debes seleccionar una categoría.');
      return;
    }

    const tagsArray = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 5);

    setLoading(true);

    try {
      const post = await createPost(
        {
          type,
          category_id: categoryId,
          title: title.trim(),
          content: content.trim(),
          province: province.trim() || undefined,
          city: city.trim() || undefined,
          tags: tagsArray,
        },
        user.id
      );

      router.push(`/p/${post.slug}`);
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al crear la publicación.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (loadingUser) {
    return <div className="text-center text-xs text-zinc-500 py-12">Cargando datos...</div>;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-12 text-center space-y-4">
        <h1 className="text-xl font-bold text-zinc-100">Acceso Requerido</h1>
        <p className="text-xs text-zinc-400">
          Debes iniciar sesión con tu cuenta para crear publicaciones en la comunidad.
        </p>
        <div className="pt-2">
          <button
            onClick={() => router.push('/login?redirectTo=/publicar')}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white shadow hover:bg-indigo-500 transition"
          >
            Iniciar sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
          <PlusCircle className="h-6 w-6 text-indigo-400" />
          Crear Publicación Anónima
        </h1>
        <p className="text-xs sm:text-sm text-zinc-400 mt-1">
          Comparte tu experiencia, realiza una pregunta o publica una confesión anónima.
        </p>
      </div>

      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200 text-xs space-y-2">
        <div className="flex items-center gap-2 font-semibold text-amber-400 text-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Recordatorio de Privacidad y Seguridad
        </div>
        <p>Por favor, revisa tu publicación antes de enviar. Queda estrictamente prohibido incluir:</p>
        <ul className="list-disc list-inside space-y-1 text-amber-300/80">
          <li>Números de teléfono o enlaces directos a WhatsApp / Telegram</li>
          <li>Direcciones de domicilio, coordenadas GPS o ubicaciones exactas</li>
          <li>Números de DNI o datos de identidad de terceros</li>
          <li>Material íntimo o imágenes sin consentimiento explícito</li>
        </ul>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-xl backdrop-blur-sm">
        <div>
          <label className="block text-xs font-semibold text-zinc-300 mb-2">
            Tipo de publicación *
          </label>
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setType('EXPERIENCE')}
              className={`rounded-lg py-2.5 text-xs font-medium border transition ${
                type === 'EXPERIENCE'
                  ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300 font-semibold shadow'
                  : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              EXPERIENCIA
            </button>
            <button
              type="button"
              onClick={() => setType('QUESTION')}
              className={`rounded-lg py-2.5 text-xs font-medium border transition ${
                type === 'QUESTION'
                  ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300 font-semibold shadow'
                  : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              PREGUNTA
            </button>
            <button
              type="button"
              onClick={() => setType('CONFESSION')}
              className={`rounded-lg py-2.5 text-xs font-medium border transition ${
                type === 'CONFESSION'
                  ? 'border-purple-500 bg-purple-500/20 text-purple-300 font-semibold shadow'
                  : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              CONFESIÓN
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-300 mb-1">
            Categoría *
          </label>
          <select
            required
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-xs sm:text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none"
          >
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-300 mb-1">
            Título de la publicación *
          </label>
          <input
            type="text"
            required
            minLength={5}
            maxLength={150}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título claro y descriptivo..."
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-xs sm:text-sm text-zinc-100 placeholder-zinc-600 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-300 mb-1">
            Contenido (Relato / Consulta) *
          </label>
          <textarea
            rows={8}
            required
            minLength={20}
            maxLength={10000}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Escribe aquí tu experiencia o pregunta detallada..."
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-xs sm:text-sm text-zinc-100 placeholder-zinc-600 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">
              Provincia / Estado (Opcional)
            </label>
            <input
              type="text"
              value={province}
              onChange={(e) => setProvince(e.target.value)}
              placeholder="ej. Buenos Aires"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-300 mb-1">
              Ciudad / Zona general (Opcional)
            </label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="ej. CABA"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-300 mb-1">
            Tags (separados por comas, máx. 5)
          </label>
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="ej. fantasias, comunicación, acuerdos"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 placeholder-zinc-600 focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-indigo-600 py-3 text-xs sm:text-sm font-medium text-white hover:bg-indigo-500 transition shadow disabled:opacity-50"
        >
          {loading ? 'Publicando...' : 'Publicar de forma anónima'}
        </button>
      </form>
    </div>
  );
}
