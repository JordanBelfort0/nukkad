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
