import { ReservationService } from '@/lib/reservation-service';
import { handleApiError, apiSuccess } from '@/lib/errors';
import { uuidSchema } from '@/lib/validations';
import { NextRequest } from 'next/server';
import { serializeReservation } from '@/lib/serialize';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate parameter format
    const parsedId = uuidSchema.parse(id);

    // Call transactional confirm logic
    const reservation = await ReservationService.confirmReservation(parsedId);

    // Safely serialize database results with relations
    const formatted = serializeReservation(reservation);

    return apiSuccess({
      message: 'Reservation successfully confirmed and purchase completed.',
      reservation: formatted,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
