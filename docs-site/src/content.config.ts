import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const docs = defineCollection({
  loader: glob({
    pattern: '**/*.md',
    base: '../docs',
  }),
  schema: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    order: z.number().optional(),
    section: z.string().optional(),
    status: z.enum(['draft', 'review', 'stable']).optional(),
  }),
});

export const collections = { docs };
