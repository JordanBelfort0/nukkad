"use client";

import { useState, useEffect, useCallback } from "react";
import { apiGet, apiPost, apiDelete } from "@/lib/api-client";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Business {
  id: string;
  name: string;
  category: string;
  city: string;
  address: string;
  lat: number;
  lng: number;
  description?: string | null;
  rating: number;
}

interface Offering {
  id: string;
  businessId: string;
  type: "product" | "service";
  name: string;
  description?: string | null;
  price: number;
  stock?: number | null;
  durationMinutes?: number | null;
  isAvailable: boolean;
  imageUrl?: string | null;
}

interface BusinessWithOfferings extends Business {
  offerings: Offering[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CATEGORY_OPTIONS = [
  "Groceries",
  "Restaurant",
  "Pharmacy",
  "Electronics",
  "Clothing",
  "Beauty & Wellness",
  "Home Services",
  "Other",
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OfferingsPage() {
  // business state
  const [business, setBusiness] = useState<Business | null>(null);
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [loadingBusiness, setLoadingBusiness] = useState(true);
  const [businessError, setBusinessError] = useState<string | null>(null);

  // create-business form
  const [bName, setBName] = useState("");
  const [bDesc, setBDesc] = useState("");
  const [bCategory, setBCategory] = useState(CATEGORY_OPTIONS[0]);
  const [bCity, setBCity] = useState("");
  const [bAddress, setBAddress] = useState("");
  const [bLat, setBLat] = useState("");
  const [bLng, setBLng] = useState("");
  const [bSubmitting, setBSubmitting] = useState(false);
  const [bError, setBError] = useState<string | null>(null);

  // add-offering form
  const [ofType, setOfType] = useState<"product" | "service">("product");
  const [ofName, setOfName] = useState("");
  const [ofDesc, setOfDesc] = useState("");
  const [ofPrice, setOfPrice] = useState("");
  const [ofStock, setOfStock] = useState("");
  const [ofDuration, setOfDuration] = useState("");
  const [ofImageUrl, setOfImageUrl] = useState("");
  const [ofSubmitting, setOfSubmitting] = useState(false);
  const [ofError, setOfError] = useState<string | null>(null);
  const [ofSuccess, setOfSuccess] = useState(false);

  // delete
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ── Load manager's own business ──────────────────────────────────────────
  const reloadManagerBusiness = useCallback(async () => {
    try {
      const data = await apiGet<{ business: Business; offerings: Offering[] } | null>("/api/manager/business");
      if (data) {
        setBusiness(data.business);
        setOfferings(data.offerings ?? []);
      } else {
        setBusiness(null);
        setOfferings([]);
      }
    } catch (err: unknown) {
      setBusinessError(err instanceof Error ? err.message : "Failed to load business.");
    }
  }, []);

  // Keep a helper for reloading by id (used after add/delete offering)
  const reloadBusiness = useCallback(async (id: string) => {
    try {
      const data = await apiGet<BusinessWithOfferings>(`/api/businesses/${id}`);
      setBusiness(data);
      setOfferings(data.offerings ?? []);
    } catch (err: unknown) {
      setBusinessError(err instanceof Error ? err.message : "Failed to load business.");
    }
  }, []);

  useEffect(() => {
    reloadManagerBusiness().finally(() => setLoadingBusiness(false));
  }, [reloadManagerBusiness]);

  // ── Create business ───────────────────────────────────────────────────────
  async function handleCreateBusiness(e: React.FormEvent) {
    e.preventDefault();
    setBError(null);

    const lat = parseFloat(bLat);
    const lng = parseFloat(bLng);
    if (isNaN(lat) || isNaN(lng)) {
      setBError("Latitude and longitude must be valid numbers.");
      return;
    }

    setBSubmitting(true);
    try {
      const created = await apiPost<Business>("/api/businesses", {
        name: bName.trim(),
        description: bDesc.trim() || undefined,
        category: bCategory,
        city: bCity.trim(),
        address: bAddress.trim(),
        lat,
        lng,
      });
      setBusiness(created);
      setOfferings([]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create business.";
      setBError(msg);
      // If already exists (409), reload from server so the UI reflects the existing business
      if (msg.includes("already have a business")) {
        await reloadManagerBusiness();
      }
    } finally {
      setBSubmitting(false);
    }
  }

  // ── Add offering ──────────────────────────────────────────────────────────
  async function handleAddOffering(e: React.FormEvent) {
    e.preventDefault();
    if (!business) return;
    setOfError(null);
    setOfSuccess(false);

    const price = parseFloat(ofPrice);
    if (isNaN(price) || price < 0) {
      setOfError("Price must be a non-negative number.");
      return;
    }

    const payload: Record<string, unknown> = {
      businessId: business.id,
      type: ofType,
      name: ofName.trim(),
      description: ofDesc.trim() || undefined,
      price,
      imageUrl: ofImageUrl.trim() || undefined,
    };

    if (ofType === "product") {
      const stock = parseInt(ofStock, 10);
      if (isNaN(stock) || stock < 0) {
        setOfError("Stock must be a non-negative integer.");
        return;
      }
      payload.stock = stock;
    } else {
      const duration = parseInt(ofDuration, 10);
      if (isNaN(duration) || duration <= 0) {
        setOfError("Duration must be a positive integer (minutes).");
        return;
      }
      payload.durationMinutes = duration;
    }

    setOfSubmitting(true);
    try {
      await apiPost<Offering>("/api/offerings", payload);
      setOfSuccess(true);
      // Reset form
      setOfName("");
      setOfDesc("");
      setOfPrice("");
      setOfStock("");
      setOfDuration("");
      setOfImageUrl("");
      // Reload offerings
      await reloadBusiness(business.id);
    } catch (err: unknown) {
      setOfError(err instanceof Error ? err.message : "Failed to add offering.");
    } finally {
      setOfSubmitting(false);
    }
  }

  // ── Delete offering ───────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    if (!business) return;
    setDeleteError(null);
    setDeletingId(id);
    try {
      await apiDelete<{ success: boolean }>(`/api/offerings/${id}`);
      await reloadBusiness(business.id);
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete offering.");
    } finally {
      setDeletingId(null);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loadingBusiness) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Loading…</p>
      </div>
    );
  }

  if (businessError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <p className="text-red-600">{businessError}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="max-w-2xl mx-auto flex flex-col gap-8">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Manage offerings</h1>
          {business && (
            <p className="text-sm text-gray-500 mt-1">
              {business.name} — {business.city}
            </p>
          )}
        </div>

        {/* Create business form */}
        {!business && (
          <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Create your business</h2>

            <form onSubmit={handleCreateBusiness} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700" htmlFor="bName">Business name</label>
                <input
                  id="bName"
                  type="text"
                  required
                  value={bName}
                  onChange={(e) => setBName(e.target.value)}
                  placeholder="e.g. Fresh Mart"
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700" htmlFor="bDesc">Description (optional)</label>
                <textarea
                  id="bDesc"
                  rows={2}
                  value={bDesc}
                  onChange={(e) => setBDesc(e.target.value)}
                  placeholder="What does your business offer?"
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700" htmlFor="bCategory">Category</label>
                <select
                  id="bCategory"
                  value={bCategory}
                  onChange={(e) => setBCategory(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700" htmlFor="bCity">City</label>
                <input
                  id="bCity"
                  type="text"
                  required
                  value={bCity}
                  onChange={(e) => setBCity(e.target.value)}
                  placeholder="e.g. Mumbai"
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700" htmlFor="bAddress">Address</label>
                <input
                  id="bAddress"
                  type="text"
                  required
                  value={bAddress}
                  onChange={(e) => setBAddress(e.target.value)}
                  placeholder="e.g. 12 MG Road, Andheri West"
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700" htmlFor="bLat">Latitude</label>
                  <input
                    id="bLat"
                    type="number"
                    step="any"
                    required
                    value={bLat}
                    onChange={(e) => setBLat(e.target.value)}
                    placeholder="19.0760"
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700" htmlFor="bLng">Longitude</label>
                  <input
                    id="bLng"
                    type="number"
                    step="any"
                    required
                    value={bLng}
                    onChange={(e) => setBLng(e.target.value)}
                    placeholder="72.8777"
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {bError && <p className="text-sm text-red-600">{bError}</p>}

              <button
                type="submit"
                disabled={bSubmitting}
                className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {bSubmitting ? "Creating…" : "Create business"}
              </button>
            </form>
          </section>
        )}

        {/* Add offering form */}
        {business && (
          <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Add an offering</h2>

            {/* Product / Service toggle */}
            <div className="flex rounded-lg border border-gray-300 overflow-hidden mb-4 w-fit">
              <button
                type="button"
                onClick={() => setOfType("product")}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  ofType === "product"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                Product
              </button>
              <button
                type="button"
                onClick={() => setOfType("service")}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  ofType === "service"
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                Service
              </button>
            </div>

            <form onSubmit={handleAddOffering} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700" htmlFor="ofName">Name</label>
                <input
                  id="ofName"
                  type="text"
                  required
                  value={ofName}
                  onChange={(e) => setOfName(e.target.value)}
                  placeholder={ofType === "product" ? "e.g. Organic Tomatoes" : "e.g. Deep Tissue Massage"}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700" htmlFor="ofDesc">Description (optional)</label>
                <textarea
                  id="ofDesc"
                  rows={2}
                  value={ofDesc}
                  onChange={(e) => setOfDesc(e.target.value)}
                  placeholder="Brief description…"
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700" htmlFor="ofPrice">Price (₹)</label>
                  <input
                    id="ofPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={ofPrice}
                    onChange={(e) => setOfPrice(e.target.value)}
                    placeholder="0.00"
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {ofType === "product" ? (
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700" htmlFor="ofStock">Stock (units)</label>
                    <input
                      id="ofStock"
                      type="number"
                      min="0"
                      step="1"
                      required
                      value={ofStock}
                      onChange={(e) => setOfStock(e.target.value)}
                      placeholder="100"
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-gray-700" htmlFor="ofDuration">Duration (mins)</label>
                    <input
                      id="ofDuration"
                      type="number"
                      min="1"
                      step="1"
                      required
                      value={ofDuration}
                      onChange={(e) => setOfDuration(e.target.value)}
                      placeholder="60"
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700" htmlFor="ofImageUrl">Image URL (optional)</label>
                <input
                  id="ofImageUrl"
                  type="url"
                  value={ofImageUrl}
                  onChange={(e) => setOfImageUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {ofError && <p className="text-sm text-red-600">{ofError}</p>}
              {ofSuccess && <p className="text-sm text-green-600">Offering added successfully.</p>}

              <button
                type="submit"
                disabled={ofSubmitting}
                className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {ofSubmitting ? "Adding…" : "Add offering"}
              </button>
            </form>
          </section>
        )}

        {/* Existing offerings list */}
        {business && (
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              Current offerings
              <span className="ml-2 text-sm font-normal text-gray-500">({offerings.length})</span>
            </h2>

            {deleteError && (
              <p className="mb-3 text-sm text-red-600">{deleteError}</p>
            )}

            {offerings.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
                <p className="text-gray-500 text-sm">No offerings yet. Add your first one above.</p>
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {offerings.map((o) => (
                  <li
                    key={o.id}
                    className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 flex items-start justify-between gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900">{o.name}</span>
                        <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${
                          o.type === "product"
                            ? "bg-violet-100 text-violet-700"
                            : "bg-teal-100 text-teal-700"
                        }`}>
                          {o.type}
                        </span>
                        {!o.isAvailable && (
                          <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                            unavailable
                          </span>
                        )}
                      </div>

                      {o.description && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{o.description}</p>
                      )}

                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-600">
                        <span className="font-semibold">₹{o.price.toFixed(2)}</span>
                        {o.type === "product" && o.stock != null && (
                          <span>{o.stock} in stock</span>
                        )}
                        {o.type === "service" && o.durationMinutes != null && (
                          <span>{o.durationMinutes} mins</span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDelete(o.id)}
                      disabled={deletingId === o.id}
                      className="flex-shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {deletingId === o.id ? "Deleting…" : "Delete"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
