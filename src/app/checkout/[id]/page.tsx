import { prisma } from '@/lib/prisma';
import CheckoutClient from '@/components/CheckoutClient';
import Link from 'next/link';
import { ArrowLeft, PackageOpen } from 'lucide-react';
import { serializeReservation } from '@/lib/serialize';

export const dynamic = 'force-dynamic';

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Query reservation details directly in this Server Component
  const reservation = await prisma.reservation.findUnique({
    where: { id },
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

  // Handle case where reservation doesn't exist
  if (!reservation) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-md text-center flex-1 flex flex-col justify-center items-center animate-slide-in">
        <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500 mb-6">
          <PackageOpen className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Reservation Not Found</h2>
        <p className="text-zinc-500 text-xs leading-relaxed mb-8">
          The checkout link is invalid or the reservation reference has been wiped. Please start over from the product catalog.
        </p>
        <Link
          href="/"
          className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs uppercase tracking-wide flex items-center gap-1.5 active:scale-[0.98] transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Catalog</span>
        </Link>
      </div>
    );
  }

  // Format Prisma Decimal and Date fields safely using the unified utility
  const formatted = serializeReservation(reservation);

  return <CheckoutClient initialReservation={formatted} />;
}
