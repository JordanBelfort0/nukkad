import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-lg w-full text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Local Commerce Platform
        </h1>
        <p className="text-lg text-gray-600 mb-10">
          Discover local businesses, browse their offerings, and get orders
          delivered to your door — all in one place. Business managers can list
          their services; delivery riders can earn by fulfilling orders.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/signup"
            className="inline-block rounded-lg bg-blue-600 px-6 py-3 text-base font-semibold text-white hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Sign up
          </Link>
          <Link
            href="/login"
            className="inline-block rounded-lg border border-gray-300 bg-white px-6 py-3 text-base font-semibold text-gray-700 hover:bg-gray-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
}
