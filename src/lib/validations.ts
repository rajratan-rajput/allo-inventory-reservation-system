import { z } from 'zod';

export const reservationCreateSchema = z.object({
  productId: z.string().uuid({ message: 'Invalid product ID format. Must be a UUID.' }),
  warehouseId: z.string().uuid({ message: 'Invalid warehouse ID format. Must be a UUID.' }),
  quantity: z.number().int().min(1, { message: 'Quantity must be a positive integer (at least 1).' }),
});

export type ReservationCreateInput = z.infer<typeof reservationCreateSchema>;

export const uuidSchema = z.string().uuid({ message: 'Invalid ID format. Must be a UUID.' });
