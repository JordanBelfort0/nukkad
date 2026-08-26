"use client";

import { useState, useEffect, useCallback } from "react";
import { apiGet, apiPatch } from "@/lib/api-client";

// ── Shared types ──────────────────────────────────────────────────────────────

type BookingStatus = "requested" | "accepted" | "declined" | "completed";

interface BookingRequest {
  id: string;
  userId: string;
  businessId: string;
  offeringId: string;
  status: BookingStatus;
  note: string | null;
  createdAt: string;
}

const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  requested: "Requested",
  accepted: "Accepted",
  declined: "Declined",
  completed: "Completed",
};

const BOOKING_STATUS_COLORS: Record<BookingStatus, string> = {
  requested: "bg-yellow-100 text-yellow-800",
  accepted: "bg-green-100 text-green-800",
  declined: "bg-red-100 text-red-800",
  completed: "bg-gray-100 text-gray-700",
};

type Role = "manager" | "user" | "delivery";

interface Me {
  userId: string;
  role: Role;
}

// ─────────────────────────────────────────────────────────────────────────────
// Manager dashboard
// ─────────────────────────────────────────────────────────────────────────────

type OrderStatus = "pending" | "accepted" | "assigned" | "picked_up" | "delivered" | "cancelled";

interface Order {
  id: string;
  userId: string;
  businessId: string;
  deliveryPartnerId?: string | null;
  status: OrderStatus;
  deliveryAddress: string;
  totalAmount: number;
  createdAt: string;
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  assigned: "Partner assigned",
  picked_up: "Picked up",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  accepted: "bg-blue-100 text-blue-800",
  assigned: "bg-indigo-100 text-indigo-800",
  picked_up: "bg-purple-100 text-purple-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

interface OrderCardProps {
  order: Order;
  onAccept: (orderId: string) => void;
  accepting: Record<string, boolean>;
  acceptError: Record<string, string>;
}

function OrderCard({ order, onAccept, accepting, acceptError }: OrderCardProps) {
  const isPending = order.status === "pending";
  const err = acceptError[order.id];
  const isAccepting = accepting[order.id];

  return (
    <li className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-400 font-mono">{order.id.slice(0, 8)}…</p>
          <p className="text-sm text-gray-700 mt-1 truncate">{order.deliveryAddress}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {new Date(order.createdAt).toLocaleDateString("en-IN", {
              day: "numeric", month: "short", year: "numeric",
              hour: "2-digit", minute: "2-digit",
            })}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[order.status]}`}>
            {STATUS_LABELS[order.status]}
          </span>
          <p className="text-sm font-semibold text-gray-900 mt-1">₹{order.totalAmount.toFixed(2)}</p>
        </div>
      </div>

      {order.deliveryPartnerId && (
        <p className="mt-2 text-xs text-gray-500">
          Partner: <span className="font-mono text-gray-700">{order.deliveryPartnerId.slice(0, 8)}…</span>
        </p>
      )}
      {order.status === "accepted" && !order.deliveryPartnerId && (
        <p className="mt-2 text-xs text-blue-600">Waiting for a delivery partner…</p>
      )}

      {isPending && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          {err && <p className="mb-2 text-xs text-red-600">{err}</p>}
          <button
            type="button"
            onClick={() => onAccept(order.id)}
            disabled={isAccepting}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isAccepting ? "Accepting…" : "Accept order"}
          </button>
        </div>
      )}
    </li>
  );
}

function ManagerDashboard() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState<Record<string, boolean>>({});
  const [acceptError, setAcceptError] = useState<Record<string, string>>({});

  const [bookings, setBookings] = useState<BookingRequest[] | null>(null);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [bookingsError, setBookingsError] = useState<string | null>(null);
  const [decidingBooking, setDecidingBooking] = useState<Record<string, boolean>>({});
  const [bookingDecideError, setBookingDecideError] = useState<Record<string, string>>({});

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<Order[]>("/api/manager/orders");
      setOrders(data);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load orders.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadBookings = useCallback(async () => {
    setBookingsLoading(true);
    try {
      const data = await apiGet<BookingRequest[]>("/api/manager/bookings");
      setBookings(data);
      setBookingsError(null);
    } catch (err: unknown) {
      setBookingsError(err instanceof Error ? err.message : "Failed to load bookings.");
    } finally {
      setBookingsLoading(false);
    }
  }, []);

  useEffect(() => { loadOrders(); }, [loadOrders]);
  useEffect(() => { loadBookings(); }, [loadBookings]);

  async function handleBookingDecision(bookingId: string, decision: "accepted" | "declined") {
    setDecidingBooking((prev) => ({ ...prev, [bookingId]: true }));
    setBookingDecideError((prev) => ({ ...prev, [bookingId]: "" }));
    try {
      const updated = await apiPatch<BookingRequest>(`/api/bookings/${bookingId}`, { decision });
      setBookings((prev) =>
        prev ? prev.map((b) => (b.id === bookingId ? { ...b, ...updated } : b)) : prev
      );
    } catch (err: unknown) {
      setBookingDecideError((prev) => ({
        ...prev,
        [bookingId]: err instanceof Error ? err.message : "Failed to update booking.",
      }));
    } finally {
      setDecidingBooking((prev) => ({ ...prev, [bookingId]: false }));
    }
  }

  async function handleAccept(orderId: string) {
    setAccepting((prev) => ({ ...prev, [orderId]: true }));
    setAcceptError((prev) => ({ ...prev, [orderId]: "" }));
    try {
      const updated = await apiPatch<Order>(`/api/orders/${orderId}`, {});
      setOrders((prev) =>
        prev ? prev.map((o) => (o.id === orderId ? { ...o, ...updated } : o)) : prev
      );
    } catch (err: unknown) {
      setAcceptError((prev) => ({
        ...prev,
        [orderId]: err instanceof Error ? err.message : "Failed to accept order.",
      }));
    } finally {
      setAccepting((prev) => ({ ...prev, [orderId]: false }));
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-gray-500">Loading orders…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20 px-4">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  const pending = orders?.filter((o) => o.status === "pending") ?? [];
  const active = orders?.filter((o) => !["pending", "delivered", "cancelled"].includes(o.status)) ?? [];
  const past = orders?.filter((o) => ["delivered", "cancelled"].includes(o.status)) ?? [];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Manager dashboard</h1>
        <button type="button" onClick={loadOrders} className="text-sm text-blue-600 hover:underline">Refresh</button>
      </div>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-800">
            Booking requests <span className="ml-1 text-sm font-normal text-gray-500">({bookings?.length ?? 0})</span>
          </h2>
          <button type="button" onClick={loadBookings} className="text-sm text-blue-600 hover:underline">Refresh</button>
        </div>

        {bookingsLoading ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 text-center">
            <p className="text-gray-500 text-sm">Loading bookings…</p>
          </div>
        ) : bookingsError ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 text-center">
            <p className="text-red-600 text-sm">{bookingsError}</p>
          </div>
        ) : !bookings || bookings.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 text-center">
            <p className="text-gray-500 text-sm">No booking requests yet.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {bookings.map((b) => {
              const isRequested = b.status === "requested";
              const busy = decidingBooking[b.id];
              const err = bookingDecideError[b.id];
              return (
                <li key={b.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-400 font-mono">{b.id.slice(0, 8)}…</p>
                      <p className="text-xs text-gray-500 mt-0.5">Offering: <span className="font-mono">{b.offeringId.slice(0, 8)}…</span></p>
                      {b.note && <p className="text-sm text-gray-700 mt-1 italic">&ldquo;{b.note}&rdquo;</p>}
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(b.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric", month: "short", year: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${BOOKING_STATUS_COLORS[b.status]}`}>
                      {BOOKING_STATUS_LABELS[b.status]}
                    </span>
                  </div>

                  {isRequested && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      {err && <p className="mb-2 text-xs text-red-600">{err}</p>}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleBookingDecision(b.id, "accepted")}
                          disabled={busy}
                          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {busy ? "Updating…" : "Accept"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleBookingDecision(b.id, "declined")}
                          disabled={busy}
                          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {busy ? "Updating…" : "Decline"}
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-base font-semibold text-gray-800 mb-3">
          Pending orders <span className="ml-1 text-sm font-normal text-gray-500">({pending.length})</span>
        </h2>
        {pending.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 text-center">
            <p className="text-gray-500 text-sm">No pending orders.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">{pending.map((o) => <OrderCard key={o.id} order={o} onAccept={handleAccept} accepting={accepting} acceptError={acceptError} />)}</ul>
        )}
      </section>

      <section>
        <h2 className="text-base font-semibold text-gray-800 mb-3">
          Active orders <span className="ml-1 text-sm font-normal text-gray-500">({active.length})</span>
        </h2>
        {active.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 text-center">
            <p className="text-gray-500 text-sm">No active orders in progress.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">{active.map((o) => <OrderCard key={o.id} order={o} onAccept={handleAccept} accepting={accepting} acceptError={acceptError} />)}</ul>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-gray-800 mb-3">
            Past orders <span className="ml-1 text-sm font-normal text-gray-500">({past.length})</span>
          </h2>
          <ul className="flex flex-col gap-3">{past.map((o) => <OrderCard key={o.id} order={o} onAccept={handleAccept} accepting={accepting} acceptError={acceptError} />)}</ul>
        </section>
      )}

      {(!orders || orders.length === 0) && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 text-center">
          <p className="text-gray-500">No orders received yet.</p>
          <p className="text-sm text-gray-400 mt-1">Make sure your business and offerings are set up at <a href="/offerings" className="text-blue-600 hover:underline">/offerings</a>.</p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Delivery dashboard
// ─────────────────────────────────────────────────────────────────────────────

type JobStatus = "assigned" | "picked_up";

interface Job {
  id: string;
  businessId: string;
  userId: string;
  status: JobStatus;
  deliveryAddress: string;
  totalAmount: number;
  createdAt: string;
}

function DeliveryDashboard() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [geoLoading, setGeoLoading] = useState(false);
  const [availLoading, setAvailLoading] = useState(false);
  const [availError, setAvailError] = useState<string | null>(null);
  const [availSuccess, setAvailSuccess] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsError, setJobsError] = useState<string | null>(null);

  const [transitioning, setTransitioning] = useState<Record<string, boolean>>({});
  const [transitionError, setTransitionError] = useState<Record<string, string>>({});

  function requestGeo() {
    if (!navigator.geolocation) {
      setGeoError("Geolocation not supported. Enter coordinates manually.");
      return;
    }
    setGeoLoading(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toString());
        setLng(pos.coords.longitude.toString());
        setGeoLoading(false);
      },
      (err) => {
        setGeoError(`Could not get location: ${err.message}. Enter manually.`);
        setGeoLoading(false);
      },
      { timeout: 10000 }
    );
  }

  useEffect(() => { requestGeo(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadJobs = useCallback(async () => {
    try {
      const data = await apiGet<Job[]>("/api/delivery/jobs");
      setJobs(data);
      setJobsError(null);
    } catch (err: unknown) {
      setJobsError(err instanceof Error ? err.message : "Failed to load jobs.");
    } finally {
      setJobsLoading(false);
    }
  }, []);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  async function handleToggleAvailability() {
    setAvailError(null);
    setAvailSuccess(false);
    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    if (isNaN(parsedLat) || isNaN(parsedLng)) {
      setAvailError("Please enter valid latitude and longitude before toggling.");
      return;
    }
    const next = !isAvailable;
    setAvailLoading(true);
    try {
      await apiPatch("/api/delivery/availability", { isAvailable: next, lat: parsedLat, lng: parsedLng });
      setIsAvailable(next);
      setAvailSuccess(true);
    } catch (err: unknown) {
      setAvailError(err instanceof Error ? err.message : "Failed to update availability.");
    } finally {
      setAvailLoading(false);
    }
  }

  async function handleStatusTransition(jobId: string, to: "picked_up" | "delivered") {
    setTransitioning((prev) => ({ ...prev, [jobId]: true }));
    setTransitionError((prev) => ({ ...prev, [jobId]: "" }));
    try {
      await apiPatch(`/api/orders/${jobId}/status`, { to });
      await loadJobs();
    } catch (err: unknown) {
      setTransitionError((prev) => ({
        ...prev,
        [jobId]: err instanceof Error ? err.message : "Status update failed.",
      }));
    } finally {
      setTransitioning((prev) => ({ ...prev, [jobId]: false }));
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold text-gray-900">Delivery dashboard</h1>

      {/* Availability card */}
      <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Availability</h2>
        <p className="text-sm text-gray-500 mb-4">Set your location and toggle availability to receive jobs.</p>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700" htmlFor="dlat">Latitude</label>
            <input
              id="dlat" type="number" step="any" value={lat}
              onChange={(e) => setLat(e.target.value)} placeholder="19.0760"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700" htmlFor="dlng">Longitude</label>
            <input
              id="dlng" type="number" step="any" value={lng}
              onChange={(e) => setLng(e.target.value)} placeholder="72.8777"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <button
          type="button" onClick={requestGeo} disabled={geoLoading}
          className="mb-3 text-sm text-blue-600 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {geoLoading ? "Getting location…" : "Use my current location"}
        </button>

        {geoError && <p className="mb-3 text-xs text-amber-700">{geoError}</p>}

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleToggleAvailability}
            disabled={availLoading}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${isAvailable ? "bg-green-500" : "bg-gray-300"}`}
            role="switch"
            aria-checked={isAvailable}
          >
            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isAvailable ? "translate-x-5" : "translate-x-0"}`} />
          </button>
          <span className="text-sm font-medium text-gray-700">
            {availLoading ? "Updating…" : isAvailable ? "Available for deliveries" : "Not available"}
          </span>
        </div>

        {availError && <p className="mt-2 text-sm text-red-600">{availError}</p>}
        {availSuccess && (
          <p className="mt-2 text-sm text-green-600">
            Availability set to {isAvailable ? "available" : "unavailable"}.
          </p>
        )}
      </section>

      {/* Jobs list */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">
            My jobs {jobs && <span className="ml-1 text-sm font-normal text-gray-500">({jobs.length})</span>}
          </h2>
          <button type="button" onClick={loadJobs} className="text-sm text-blue-600 hover:underline">Refresh</button>
        </div>

        {jobsLoading ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
            <p className="text-gray-500 text-sm">Loading jobs…</p>
          </div>
        ) : jobsError ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 text-center">
            <p className="text-red-600 text-sm">{jobsError}</p>
          </div>
        ) : !jobs || jobs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
            <p className="text-gray-500 text-sm">No active jobs right now.</p>
            <p className="text-gray-400 text-xs mt-1">Toggle availability above to receive new orders.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {jobs.map((job) => {
              const isAssigned = job.status === "assigned";
              const err = transitionError[job.id];
              const busy = transitioning[job.id];

              return (
                <li key={job.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-400 font-mono">{job.id.slice(0, 8)}…</p>
                      <p className="text-sm text-gray-700 mt-1 truncate">{job.deliveryAddress}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(job.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric", month: "short", year: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${isAssigned ? "bg-indigo-100 text-indigo-700" : "bg-purple-100 text-purple-700"}`}>
                        {isAssigned ? "Assigned" : "Picked up"}
                      </span>
                      <p className="text-sm font-semibold text-gray-900 mt-1">₹{job.totalAmount.toFixed(2)}</p>
                    </div>
                  </div>

                  {err && <p className="mt-2 text-xs text-red-600">{err}</p>}

                  <div className="mt-3 pt-3 border-t border-gray-100 flex gap-2">
                    {isAssigned && (
                      <button
                        type="button"
                        onClick={() => handleStatusTransition(job.id, "picked_up")}
                        disabled={busy}
                        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {busy ? "Updating…" : "Mark picked up"}
                      </button>
                    )}
                    {!isAssigned && (
                      <button
                        type="button"
                        onClick={() => handleStatusTransition(job.id, "delivered")}
                        disabled={busy}
                        className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {busy ? "Updating…" : "Mark delivered"}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root page — detects role and renders appropriate dashboard
// ─────────────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<Me>("/api/auth/me")
      .then(setMe)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Authentication error."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  if (error || !me) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red-600 mb-3">{error ?? "Not authenticated."}</p>
          <a href="/login" className="text-sm text-blue-600 hover:underline">Go to login</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="max-w-2xl mx-auto">
        {me.role === "manager" && <ManagerDashboard />}
        {me.role === "delivery" && <DeliveryDashboard />}
        {me.role === "user" && (
          <div className="text-center py-20">
            <p className="text-gray-700">This dashboard is for managers and delivery partners.</p>
            <a href="/search" className="mt-3 inline-block text-sm text-blue-600 hover:underline">Browse businesses</a>
          </div>
        )}
      </div>
    </div>
  );
}
