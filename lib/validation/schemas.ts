import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(8),
  role: z.enum(["manager", "user", "delivery"]),
  city: z.string().min(1),
  vehicleType: z.string().optional(), // required when role=delivery (checked in route)
});

export const loginSchema = z.object({ email: z.string().email(), password: z.string() });

export const businessSchema = z.object({
  name: z.string().min(1), description: z.string().optional(),
  category: z.string().min(1), city: z.string().min(1), address: z.string().min(1),
  lat: z.number(), lng: z.number(),
});
export const offeringSchema = z.object({
  businessId: z.string().uuid(), type: z.enum(["product", "service"]),
  name: z.string().min(1), description: z.string().optional(),
  price: z.number().nonnegative(),
  stock: z.number().int().nonnegative().optional(),
  durationMinutes: z.number().int().positive().optional(),
  imageUrl: z.string().url().optional(),
}).refine(d => d.type !== "product" || d.stock != null, { message: "stock required for product" })
  .refine(d => d.type !== "service" || d.durationMinutes != null, { message: "durationMinutes required for service" });

export const orderSchema = z.object({
  businessId: z.string().uuid(),
  items: z.array(z.object({ offeringId: z.string().uuid(), quantity: z.number().int().positive() })).min(1),
  deliveryAddress: z.string().min(1),
  deliveryLat: z.number(), deliveryLng: z.number(),
});

export const bookingSchema = z.object({ offeringId: z.string().uuid(), note: z.string().optional() });
