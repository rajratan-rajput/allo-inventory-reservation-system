import { ReservationService } from '@/lib/reservation-service';
import { reservationCreateSchema } from '@/lib/validations';
import { handleApiError, apiSuccess, ValidationError } from '@/lib/errors';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const idempotencyKey = req.headers.get('Idempotency-Key') || undefined;

    // 1. Parse and validate request body
    let body;
    try {
      body = await req.json();
    } catch {
      throw new ValidationError('Invalid JSON body in request.');
    }

    const parsed = reservationCreateSchema.safeParse(body);
    if (!parsed.success) {
      throw parsed.error; // Will be formatted by handleApiError as ZodError
    }

    const { productId, warehouseId, quantity } = parsed.data;

    // 2. Delegate to transactional reservation service (uses SELECT FOR UPDATE)
    const reservation = await ReservationService.createReservation(
      productId,
      warehouseId,
      quantity,
      idempotencyKey
    );

    // 3. Return 201 Created on success
    return apiSuccess(reservation, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
