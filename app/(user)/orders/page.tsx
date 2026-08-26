"use client";

import { useState, useEffect } from "react";
import { apiGet, apiPost } from "@/lib/api-client";

type OrderStatus = "pending" | "accepted" | "assigned" | "picked_up" | "delivered" | "cancelled";

interface Order {
  id: string;
  businessId: string;
  status: OrderStatus;
  totalAmount: number;
  deliveryAddress: string;
  createdAt: string;
}

interface ReviewDraft {
  rating: number;
  comment: string;
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  assigned: "Assigned",
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

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [reviewDrafts, setReviewDrafts] = useState<Record<string, ReviewDraft>>({});
  const [reviewLoading, setReviewLoading] = useState<Record<string, boolean>>({});
  const [reviewSuccess, setReviewSuccess] = useState<Record<string, boolean>>({});
  const [reviewError, setReviewError] = useState<Record<string, string>>({});

  useEffect(() => {
    apiGet<Order[]>("/api/orders")
      .then(setOrders)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load orders."))
      .finally(() => setLoading(false));
  }, []);

  function getDraft(orderId: string): ReviewDraft {
    return reviewDrafts[orderId] ?? { rating: 5, comment: "" };
  }

  function setDraft(orderId: string, patch: Partial<ReviewDraft>) {
    setReviewDrafts((prev) => ({
      ...prev,
      [orderId]: { ...getDraft(orderId), ...patch },
    }));
  }

  async function submitReview(order: Order) {
    const draft = getDraft(order.id);
    setReviewLoading((prev) => ({ ...prev, [order.id]: true }));
    setReviewError((prev) => ({ ...prev, [order.id]: "" }));
    try {
      await apiPost("/api/reviews", {
        businessId: order.businessId,
        orderId: order.id,
        rating: draft.rating,
        comment: draft.comment || undefined,
      });
      setReviewSuccess((prev) => ({ ...prev, [order.id]: true }));
    } catch (err: unknown) {
      setReviewError((prev) => ({
        ...prev,
        [order.id]: err instanceof Error ? err.message : "Review failed.",
      }));
    } finally {
      setReviewLoading((prev) => ({ ...prev, [order.id]: false }));
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading orders…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">My orders</h1>

        {!orders || orders.length === 0 ? (
          <p className="text-center text-gray-500 py-10">You have no orders yet.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {orders.map((order) => {
              const draft = getDraft(order.id);
              const isDelivered = order.status === "delivered";
              const alreadyReviewed = reviewSuccess[order.id];

              return (
                <li key={order.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-gray-400 font-mono">{order.id.slice(0, 8)}…</p>
                      <p className="text-sm text-gray-700 mt-1">{order.deliveryAddress}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {new Date(order.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[order.status]}`}>
                        {STATUS_LABELS[order.status]}
                      </span>
                      <p className="text-sm font-semibold text-gray-900 mt-1">₹{order.totalAmount.toFixed(2)}</p>
                    </div>
                  </div>

                  {isDelivered && !alreadyReviewed && (
                    <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col gap-3">
                      <p className="text-sm font-medium text-gray-700">Leave a review</p>

                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setDraft(order.id, { rating: star })}
                            className={`text-xl ${star <= draft.rating ? "text-yellow-400" : "text-gray-300"} hover:text-yellow-400 transition-colors`}
                          >
                            ★
                          </button>
                        ))}
                        <span className="text-sm text-gray-500 ml-2 self-center">{draft.rating}/5</span>
                      </div>

                      <textarea
                        value={draft.comment}
                        onChange={(e) => setDraft(order.id, { comment: e.target.value })}
                        placeholder="How was your experience? (optional)"
                        rows={2}
                        className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      />

                      {reviewError[order.id] && (
                        <p className="text-xs text-red-600">{reviewError[order.id]}</p>
                      )}

                      <button
                        onClick={() => submitReview(order)}
                        disabled={reviewLoading[order.id]}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {reviewLoading[order.id] ? "Submitting…" : "Submit review"}
                      </button>
                    </div>
                  )}

                  {isDelivered && alreadyReviewed && (
                    <p className="mt-3 text-xs text-green-700 font-medium">Review submitted. Thank you!</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
