import { z } from 'zod';

export const postSchema = z.object({
  type: z.enum(['EXPERIENCE', 'QUESTION', 'CONFESSION'] as const, {
    message: 'Debes seleccionar un tipo de publicación',
  }),
  category_id: z.string().uuid({
    message: 'Debes seleccionar una categoría válida',
  }),
  title: z
    .string()
    .min(5, { message: 'El título debe tener al menos 5 caracteres' })
    .max(150, { message: 'El título no puede superar los 150 caracteres' }),
  content: z
    .string()
    .min(20, { message: 'El contenido debe tener al menos 20 caracteres' })
    .max(10000, { message: 'El contenido no puede superar los 10,000 caracteres' }),
  province: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  tags: z
    .array(z.string())
    .max(5, { message: 'Puedes agregar como máximo 5 tags' })
    .default([]),
});

export type PostFormValues = z.infer<typeof postSchema>;
