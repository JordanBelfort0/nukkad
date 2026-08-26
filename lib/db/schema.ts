import { pgTable, pgEnum, uuid, text, integer, doublePrecision, boolean, timestamp } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["manager", "user", "delivery"]);
export const offeringTypeEnum = pgEnum("offering_type", ["product", "service"]);
export const orderStatusEnum = pgEnum("order_status", ["pending", "accepted", "assigned", "picked_up", "delivered", "cancelled"]);
export const bookingStatusEnum = pgEnum("booking_status", ["requested", "accepted", "declined", "completed"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull(),
  city: text("city").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const deliveryProfiles = pgTable("delivery_profiles", {
  userId: uuid("user_id").primaryKey().references(() => users.id),
  vehicleType: text("vehicle_type").notNull(),
  isAvailable: boolean("is_available").notNull().default(false),
  currentLat: doublePrecision("current_lat"),
  currentLng: doublePrecision("current_lng"),
  rating: doublePrecision("rating").notNull().default(0),
});

export const businesses = pgTable("businesses", {
  id: uuid("id").primaryKey().defaultRandom(),
  managerId: uuid("manager_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  city: text("city").notNull(),
  address: text("address").notNull(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  rating: doublePrecision("rating").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const offerings = pgTable("offerings", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id").notNull().references(() => businesses.id),
  type: offeringTypeEnum("type").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  price: doublePrecision("price").notNull(),
  stock: integer("stock"),                 // products only
  durationMinutes: integer("duration_minutes"), // services only
  isAvailable: boolean("is_available").notNull().default(true),
  imageUrl: text("image_url"),
});

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  businessId: uuid("business_id").notNull().references(() => businesses.id),
  deliveryPartnerId: uuid("delivery_partner_id").references(() => users.id),
  status: orderStatusEnum("status").notNull().default("pending"),
  deliveryAddress: text("delivery_address").notNull(),
  deliveryLat: doublePrecision("delivery_lat").notNull(),
  deliveryLng: doublePrecision("delivery_lng").notNull(),
  totalAmount: doublePrecision("total_amount").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id").notNull().references(() => orders.id),
  offeringId: uuid("offering_id").notNull().references(() => offerings.id),
  quantity: integer("quantity").notNull(),
  unitPrice: doublePrecision("unit_price").notNull(),
});

export const bookingRequests = pgTable("booking_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  businessId: uuid("business_id").notNull().references(() => businesses.id),
  offeringId: uuid("offering_id").notNull().references(() => offerings.id),
  status: bookingStatusEnum("status").notNull().default("requested"),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const reviews = pgTable("reviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  businessId: uuid("business_id").notNull().references(() => businesses.id),
  orderId: uuid("order_id").references(() => orders.id),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
