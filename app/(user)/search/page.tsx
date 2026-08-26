"use client";

import { useState } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/api-client";

interface Offering {
  id: string;
  name: string;
  price: number;
  type: "product" | "service";
}

interface Business {
  id: string;
  name: string;
  rating: number;
  city: string;
}

interface SearchResult {
  offering: Offering;
  business: Business;
  distanceKm: number;
  score: number;
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("");
  const [type, setType] = useState<"" | "product" | "service">("");
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function buildUrl(lat: number, lng: number) {
    const params = new URLSearchParams({ city, lat: String(lat), lng: String(lng) });
    if (query) params.set("q", query);
    if (type) params.set("type", type);
    return `/api/search?${params.toString()}`;
  }

  async function runSearch(lat: number, lng: number) {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<SearchResult[]>(buildUrl(lat, lng));
      setResults(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!city.trim()) {
      setError("Please enter a city.");
      return;
    }

    if (showManual) {
      const lat = parseFloat(manualLat);
      const lng = parseFloat(manualLng);
      if (isNaN(lat) || isNaN(lng)) {
        setError("Enter valid lat / lng values.");
        return;
      }
      await runSearch(lat, lng);
      return;
    }

    if (!navigator.geolocation) {
      setShowManual(true);
      setError("Geolocation not supported. Enter coordinates manually.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await runSearch(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        setShowManual(true);
        setError("Location access denied. Enter coordinates manually (or use defaults below).");
      }
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">Find local businesses</h1>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col gap-4 mb-8">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Search</label>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="coffee, haircut, pizza…"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">City <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Mumbai"
              required
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as "" | "product" | "service")}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All</option>
              <option value="product">Product</option>
              <option value="service">Service</option>
            </select>
          </div>

          {showManual && (
            <div className="flex gap-3">
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-sm font-medium text-gray-700">Latitude</label>
                <input
                  type="number"
                  step="any"
                  value={manualLat}
                  onChange={(e) => setManualLat(e.target.value)}
                  placeholder="19.076"
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-sm font-medium text-gray-700">Longitude</label>
                <input
                  type="number"
                  step="any"
                  value={manualLng}
                  onChange={(e) => setManualLng(e.target.value)}
                  placeholder="72.877"
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          )}

          {!showManual && (
            <button
              type="button"
              onClick={() => setShowManual(true)}
              className="text-sm text-blue-600 hover:underline self-start"
            >
              Enter coordinates manually
            </button>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Searching…" : "Search"}
          </button>
        </form>

        {results !== null && (
          <>
            {results.length === 0 ? (
              <p className="text-center text-gray-500 py-10">No results found. Try a different search.</p>
            ) : (
              <ul className="flex flex-col gap-4">
                {results.map((r, i) => (
                  <li key={`${r.offering.id}-${i}`} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Link
                          href={`/business/${r.business.id}`}
                          className="text-base font-semibold text-blue-700 hover:underline"
                        >
                          {r.business.name}
                        </Link>
                        <p className="text-sm text-gray-700 mt-0.5">{r.offering.name}</p>
                        <p className="text-xs text-gray-400 mt-1 capitalize">{r.offering.type}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-base font-semibold text-gray-900">₹{r.offering.price.toFixed(2)}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {r.business.rating.toFixed(1)} ★ · {r.distanceKm.toFixed(1)} km
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
