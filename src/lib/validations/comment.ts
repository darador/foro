import { z } from 'zod';

export const commentSchema = z.object({
  post_id: z.string().uuid(),
  parent_id: z.string().uuid().optional().nullable(),
  content: z
    .string()
    .min(3, { message: 'El comentario debe tener al menos 3 caracteres' })
    .max(3000, { message: 'El comentario no puede superar los 3,000 caracteres' }),
});

export type CommentFormValues = z.infer<typeof commentSchema>;
