"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { apiGet, apiPost } from "@/lib/api-client";

interface Offering {
  id: string;
  name: string;
  description: string | null;
  price: number;
  type: "product" | "service";
  stock: number | null;
  durationMinutes: number | null;
  isAvailable: boolean;
}

interface Business {
  id: string;
  name: string;
  description: string | null;
  category: string;
  city: string;
  address: string;
  rating: number;
}

interface BusinessData {
  business: Business;
  offerings: Offering[];
}

interface CartItem {
  offeringId: string;
  quantity: number;
}

type Cart = Record<string, number>;

export default function BusinessPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [data, setData] = useState<BusinessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // cart state for products
  const [cart, setCart] = useState<Cart>({});
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryLat, setDeliveryLat] = useState("");
  const [deliveryLng, setDeliveryLng] = useState("");
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);

  // booking state for services
  const [bookingNotes, setBookingNotes] = useState<Record<string, string>>({});
  const [bookingLoading, setBookingLoading] = useState<Record<string, boolean>>({});
  const [bookingSuccess, setBookingSuccess] = useState<Record<string, boolean>>({});
  const [bookingError, setBookingError] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!id) return;
    apiGet<BusinessData>(`/api/businesses/${id}`)
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load business."))
      .finally(() => setLoading(false));
  }, [id]);

  function adjustCart(offeringId: string, delta: number) {
    setCart((prev) => {
      const next = { ...prev };
      const cur = next[offeringId] ?? 0;
      const newQty = cur + delta;
      if (newQty <= 0) {
        delete next[offeringId];
      } else {
        next[offeringId] = newQty;
      }
      return next;
    });
  }

  function cartTotal(offerings: Offering[]) {
    return Object.entries(cart).reduce((sum, [oid, qty]) => {
      const o = offerings.find((x) => x.id === oid);
      return sum + (o ? o.price * qty : 0);
    }, 0);
  }

  async function placeOrder(offerings: Offering[]) {
    const items: CartItem[] = Object.entries(cart).map(([offeringId, quantity]) => ({ offeringId, quantity }));
    if (items.length === 0) {
      setOrderError("Add at least one item to your cart.");
      return;
    }
    if (!deliveryAddress.trim()) {
      setOrderError("Enter a delivery address.");
      return;
    }
    const lat = parseFloat(deliveryLat);
    const lng = parseFloat(deliveryLng);
    if (isNaN(lat) || isNaN(lng)) {
      setOrderError("Enter valid delivery lat/lng.");
      return;
    }

    setOrderLoading(true);
    setOrderError(null);
    setOrderSuccess(null);
    try {
      const order = await apiPost<{ id: string }>("/api/orders", {
        businessId: id,
        items,
        deliveryAddress,
        deliveryLat: lat,
        deliveryLng: lng,
      });
      setOrderSuccess(`Order placed! ID: ${order.id}`);
      setCart({});
    } catch (err: unknown) {
      setOrderError(err instanceof Error ? err.message : "Order failed.");
    } finally {
      setOrderLoading(false);
    }
    void offerings;
  }

  async function requestBooking(offeringId: string) {
    setBookingLoading((prev) => ({ ...prev, [offeringId]: true }));
    setBookingError((prev) => ({ ...prev, [offeringId]: "" }));
    setBookingSuccess((prev) => ({ ...prev, [offeringId]: false }));
    try {
      await apiPost("/api/bookings", {
        offeringId,
        note: bookingNotes[offeringId] || undefined,
      });
      setBookingSuccess((prev) => ({ ...prev, [offeringId]: true }));
    } catch (err: unknown) {
      setBookingError((prev) => ({
        ...prev,
        [offeringId]: err instanceof Error ? err.message : "Booking failed.",
      }));
    } finally {
      setBookingLoading((prev) => ({ ...prev, [offeringId]: false }));
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <p className="text-red-600">{error ?? "Business not found."}</p>
      </div>
    );
  }

  const { business, offerings } = data;
  const products = offerings.filter((o) => o.type === "product" && o.isAvailable);
  const services = offerings.filter((o) => o.type === "service" && o.isAvailable);
  const cartItemCount = Object.values(cart).reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="max-w-2xl mx-auto">
        {/* Business header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">{business.name}</h1>
          {business.description && (
            <p className="text-sm text-gray-600 mt-1">{business.description}</p>
          )}
          <div className="flex flex-wrap gap-3 mt-3 text-xs text-gray-500">
            <span>{business.category}</span>
            <span>·</span>
            <span>{business.city}</span>
            <span>·</span>
            <span>{business.address}</span>
            <span>·</span>
            <span>{business.rating.toFixed(1)} ★</span>
          </div>
        </div>

        {/* Products */}
        {products.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Products</h2>
            <ul className="flex flex-col gap-3">
              {products.map((o) => (
                <li key={o.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-gray-900">{o.name}</p>
                      {o.description && <p className="text-xs text-gray-500 mt-0.5">{o.description}</p>}
                      {o.stock != null && (
                        <p className="text-xs text-gray-400 mt-0.5">{o.stock} in stock</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-semibold text-gray-900">₹{o.price.toFixed(2)}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() => adjustCart(o.id, -1)}
                          disabled={!cart[o.id]}
                          className="w-7 h-7 rounded-full border border-gray-300 text-gray-600 text-sm font-bold hover:bg-gray-100 disabled:opacity-30 transition-colors"
                        >
                          −
                        </button>
                        <span className="text-sm font-medium w-4 text-center">{cart[o.id] ?? 0}</span>
                        <button
                          onClick={() => adjustCart(o.id, 1)}
                          className="w-7 h-7 rounded-full border border-gray-300 text-gray-600 text-sm font-bold hover:bg-gray-100 transition-colors"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {/* Cart summary + checkout */}
            {cartItemCount > 0 && (
              <div className="mt-5 bg-blue-50 border border-blue-200 rounded-2xl p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-gray-900">{cartItemCount} item{cartItemCount !== 1 ? "s" : ""}</p>
                  <p className="font-semibold text-gray-900">₹{cartTotal(offerings).toFixed(2)}</p>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Delivery address</label>
                  <input
                    type="text"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="123, Main St, Mumbai"
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="flex gap-3">
                  <div className="flex flex-col gap-1 flex-1">
                    <label className="text-sm font-medium text-gray-700">Delivery lat</label>
                    <input
                      type="number"
                      step="any"
                      value={deliveryLat}
                      onChange={(e) => setDeliveryLat(e.target.value)}
                      placeholder="19.076"
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="flex flex-col gap-1 flex-1">
                    <label className="text-sm font-medium text-gray-700">Delivery lng</label>
                    <input
                      type="number"
                      step="any"
                      value={deliveryLng}
                      onChange={(e) => setDeliveryLng(e.target.value)}
                      placeholder="72.877"
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {orderError && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {orderError}
                  </p>
                )}
                {orderSuccess && (
                  <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                    {orderSuccess}
                  </p>
                )}

                <button
                  onClick={() => placeOrder(offerings)}
                  disabled={orderLoading}
                  className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {orderLoading ? "Placing order…" : "Place order"}
                </button>
              </div>
            )}
          </section>
        )}

        {/* Services */}
        {services.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Services</h2>
            <ul className="flex flex-col gap-3">
              {services.map((o) => (
                <li key={o.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{o.name}</p>
                      {o.description && <p className="text-xs text-gray-500 mt-0.5">{o.description}</p>}
                      {o.durationMinutes != null && (
                        <p className="text-xs text-gray-400 mt-0.5">{o.durationMinutes} min</p>
                      )}
                      <p className="font-semibold text-gray-900 mt-1">₹{o.price.toFixed(2)}</p>

                      <div className="mt-3 flex flex-col gap-2">
                        <input
                          type="text"
                          value={bookingNotes[o.id] ?? ""}
                          onChange={(e) =>
                            setBookingNotes((prev) => ({ ...prev, [o.id]: e.target.value }))
                          }
                          placeholder="Note (optional)"
                          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />

                        {bookingError[o.id] && (
                          <p className="text-xs text-red-600">{bookingError[o.id]}</p>
                        )}
                        {bookingSuccess[o.id] && (
                          <p className="text-xs text-green-700">Booking requested!</p>
                        )}

                        <button
                          onClick={() => requestBooking(o.id)}
                          disabled={bookingLoading[o.id] || bookingSuccess[o.id]}
                          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {bookingLoading[o.id] ? "Requesting…" : bookingSuccess[o.id] ? "Requested" : "Request booking"}
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {products.length === 0 && services.length === 0 && (
          <p className="text-center text-gray-500 py-10">No offerings available at this business.</p>
        )}
      </div>
    </div>
  );
}
