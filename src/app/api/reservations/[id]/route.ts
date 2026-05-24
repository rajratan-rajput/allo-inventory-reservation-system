import { prisma } from '@/lib/prisma';
import { handleApiError, apiSuccess, NotFoundError } from '@/lib/errors';
import { uuidSchema } from '@/lib/validations';
import { NextRequest } from 'next/server';
import { serializeReservation } from '@/lib/serialize';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate parameter format
    const parsedId = uuidSchema.parse(id);

    const reservation = await prisma.reservation.findUnique({
      where: { id: parsedId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            price: true,
          },
        },
        warehouse: {
          select: {
            id: true,
            name: true,
            location: true,
          },
        },
      },
    });

    if (!reservation) {
      throw new NotFoundError(`Reservation with ID ${id} not found.`);
    }

    // Safely serialize Prisma Decimal & Dates
    const formatted = serializeReservation(reservation);

    return apiSuccess(formatted);
  } catch (error) {
    return handleApiError(error);
  }
}
