# 🚀 Consisto — Multi-Warehouse Inventory Reservation System

<p align="center">
  <b>Concurrency-safe inventory reservation platform built with modern full-stack technologies.</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15-black?style=for-the-badge&logo=next.js" />
  <img src="https://img.shields.io/badge/TypeScript-Strict-blue?style=for-the-badge&logo=typescript" />
  <img src="https://img.shields.io/badge/PostgreSQL-Neon-4169E1?style=for-the-badge&logo=postgresql" />
  <img src="https://img.shields.io/badge/Prisma-ORM-2D3748?style=for-the-badge&logo=prisma" />
  <img src="https://img.shields.io/badge/TailwindCSS-Styled-38B2AC?style=for-the-badge&logo=tailwind-css" />
  <img src="https://img.shields.io/badge/Vitest-Tested-success?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Concurrency-Safe-brightgreen?style=for-the-badge" />
</p>

---

# 🌐 Live Demo

🔗 **Production URL:**
`<Yhttps://allo-inventory-reservation-systems.vercel.app/>`

---

# 📌 Overview

Consisto is a production-style multi-warehouse inventory reservation system built to solve one of the most critical backend engineering problems in e-commerce:

> Preventing inventory overselling during concurrent checkout requests.

The system uses PostgreSQL transactions and atomic row-level locking to guarantee consistency even when multiple users attempt to reserve the same inventory simultaneously.

---

# ✨ Features

✅ Multi-warehouse inventory management
✅ Real-time stock availability
✅ Temporary reservation system
✅ Reservation confirmation & cancellation
✅ Automatic reservation expiry handling
✅ Concurrency-safe checkout flow
✅ Atomic inventory locking
✅ Responsive modern UI
✅ PostgreSQL transaction safety
✅ API-first architecture
✅ Hosted Neon PostgreSQL database

---

# 🛠️ Tech Stack

| Technology        | Purpose                |
| ----------------- | ---------------------- |
| Next.js 15        | Frontend + API Routes  |
| TypeScript        | End-to-End Type Safety |
| PostgreSQL (Neon) | Database               |
| Prisma ORM        | Database Access        |
| Tailwind CSS      | Styling                |
| Zod               | Request Validation     |
| Vitest            | Testing                |

---

# ⚡ Concurrency Handling

The core engineering challenge of this project is preventing race conditions during checkout.

When multiple users try reserving the same product simultaneously:

* Only available stock can be reserved
* Overselling is impossible
* Inventory consistency is guaranteed

This is achieved using:

* PostgreSQL transactions
* Atomic inventory updates
* `SELECT ... FOR UPDATE`
* Row-level locking

### Example

If only **1 stock unit** exists:

* First reservation succeeds ✅
* Second concurrent request fails with `409 Conflict` ❌

---

## 📁 File Structure

```text
src/
 ├── app/
 │    ├── page.tsx                      # Product Catalog (Server Component)
 │    ├── layout.tsx                    # Shared layouts, global Navbar, ToastProvider
 │    ├── globals.css                   # Custom global scrollbars & slide animations
 │    ├── checkout/
 │    │    └── [id]/
 │    │         └── page.tsx            # Hold Receipt dynamic page (Server Component)
 │    └── api/
 │         ├── products/
 │         │    └── route.ts            # GET products list + detailed stock levels
 │         ├── warehouses/
 │         │    └── route.ts            # GET warehouses list
 │         ├── reservations/
 │         │    ├── route.ts            # POST create temporary hold (Row-Locked)
 │         │    ├── cleanup/
 │         │    │    └── route.ts       # POST/GET cron expired holds sweeping endpoint
 │         │    └── [id]/
 │         │         ├── confirm/
 │         │         │    └── route.ts  # POST confirm purchase & decrement physical stock
 │         │         ├── release/
 │         │         │    └── route.ts  # POST cancel hold & return stock instantly
 │         │         └── route.ts       # GET hold receipts dynamically
 ├── components/
 │    ├── Toast.tsx                     # Custom Toast Provider, slide-in alerts context
 │    ├── ProductListingClient.tsx      # Interactive product grid with warehouse filters
 │    └── CheckoutClient.tsx            # Hold timer, confirm checkout and cancel controls
 ├── lib/
 │    ├── prisma.ts                     # Prisma Client connection singleton
 │    ├── reservation-service.ts        # SELECT FOR UPDATE transaction locks core service
 │    ├── validations.ts                # Zod request validators
 │    └── errors.ts                     # Standardized exceptions & API error serializations
 ├── tests/
 │    └── reservation.test.ts           # Vitest integration and concurrency safety tests
 ├── prisma/
 │    ├── schema.prisma                 # Database schema models (Prisma format)
 │    └── seed.ts                       # Re-runnable mock seed data routine
 ├── prisma.config.ts                   # Prisma configuration
 ├── vitest.config.ts                   # Vitest configuration
 └── package.json                       # Scripts and dependencies
```

---

# 🔌 API Endpoints

| Method | Endpoint                        | Description                            |
| ------ | ------------------------------- | -------------------------------------- |
| GET    | `/api/products`                 | Fetch products with stock availability |
| GET    | `/api/warehouses`               | Fetch warehouses                       |
| POST   | `/api/reservations`             | Create reservation                     |
| POST   | `/api/reservations/:id/confirm` | Confirm reservation                    |
| POST   | `/api/reservations/:id/release` | Release reservation                    |

---

# 🗄️ Database Models

## Product

* id
* name
* description
* price

## Warehouse

* id
* name
* location

## Inventory

* totalStock
* reservedStock

## Reservation

* quantity
* status
* expiresAt

---

# ⏳ Reservation Expiry

Reservations automatically expire after **10 minutes**.

Expired reservations are cleaned using:

```bash
/api/reservations/cleanup
```

In production, this endpoint is triggered using a scheduled cron job.

Cleanup flow:

1. Find expired reservations
2. Release reserved stock
3. Mark reservations as expired

---

# 🚀 Local Setup

## 1️⃣ Clone Repository

```bash
git clone https://github.com/rajratan-rajput/allo-inventory-reservation-system
cd <PROJECT_NAME>
```

---

## 2️⃣ Install Dependencies

```bash
npm install
```

---

## 3️⃣ Configure Environment Variables

Create `.env`

```env
DATABASE_URL="YOUR_DATABASE_URL"
DIRECT_URL="YOUR_DIRECT_DATABASE_URL"

CRON_SECRET="YOUR_SECRET"

NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

---

## 4️⃣ Push Prisma Schema

```bash
npx prisma db push
```

---

## 5️⃣ Seed Database

```bash
npx tsx prisma/seed.ts
```

---

## 6️⃣ Run Development Server

```bash
npm run dev
```

Application runs at:

```text
http://localhost:3000
```

---

# 🧪 Running Tests

```bash
npm test
```

The test suite validates:

* concurrency safety
* reservation logic
* inventory consistency
* edge cases

---

# 🌍 Deployment

| Service  | Platform        |
| -------- | --------------- |
| Frontend | Vercel          |
| Database | Neon PostgreSQL |

---

# 📈 Future Improvements

* Redis distributed locking
* WebSocket live inventory updates
* Admin inventory dashboard
* Stripe payment integration
* Reservation analytics
* Queue-based processing

---

# 👨‍💻 Author

### Rajratan Rajput

Built as part of the Allo Engineering Take-Home Exercise.

---

# 📄 License

© 2026 Rajratan Rajput — All Rights Reserved.
