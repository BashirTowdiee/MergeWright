import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const docs = defineCollection({
  loader: glob({
    pattern: '**/*.md',
    base: '../docs',
  }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    order: z.number(),
    section: z.string().default('Planning'),
    status: z.enum(['draft', 'review', 'stable']).default('draft'),
  }),
});

export const collections = { docs };
