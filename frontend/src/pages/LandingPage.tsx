import { Link } from 'react-router-dom';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-cyan-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/75 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4 sm:px-8">
          <Link to="/" className="text-2xl font-bold tracking-tight text-slate-900">
            FleetTrack
          </Link>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Login
            </Link>
            <Link
              to="/register"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
            >
              Register
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-6 py-16 sm:px-8">
        <section className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="mb-4 inline-flex items-center rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-indigo-700">
              <span role="img" aria-label="rocket" className="mr-2">
                🚀
              </span>
              Fleet & Logistics
            </p>
            <h1 className="text-4xl font-black leading-tight text-slate-900 sm:text-5xl">
              Smart Fleet & Logistics Management
            </h1>
            <p className="mt-6 max-w-xl text-lg text-slate-600">
              Optimize routing, monitor vehicles in real time, and manage teams with role-based
              access control. Built for dispatchers, owners and staff who need reliability at scale.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link
                to="/register"
                className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-indigo-500"
              >
                Get Started
              </Link>
              <Link
                to="/dashboard"
                className="rounded-lg border border-indigo-600 px-6 py-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
              >
                Already Have an Account? Go to Dashboard!
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-lg">
            <img
              src="https://www.geotab.com/CMS-Media-production/Blog/NA/_2017/Nov_2017/Fleet_Management/blog-fleet-management-hero@2x.jpg"
              alt="Fleet management dashboard"
              className="h-72 w-full rounded-2xl object-cover"
            />
          </div>
        </section>

        <section className="mt-16">
          <h2 className="text-2xl font-semibold text-slate-900">Core features</h2>
          <p className="mt-2 max-w-2xl text-slate-600">
            Everything your operations team needs in one place.
          </p>

          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 text-3xl">📍</div>
              <h3 className="mb-2 text-lg font-semibold text-slate-900">Real-time Vehicle Tracking</h3>
              <p className="text-sm text-slate-600">
                View the position of every vehicle live, with mapping details and history playback.
              </p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 text-3xl">🧭</div>
              <h3 className="mb-2 text-lg font-semibold text-slate-900">Intelligent Route & Cost Calculation</h3>
              <p className="text-sm text-slate-600">
                Plan jobs efficiently and reduce operating expenses with clear route metrics.
              </p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 text-3xl">🔐</div>
              <h3 className="mb-2 text-lg font-semibold text-slate-900">Role-based Access Control</h3>
              <p className="text-sm text-slate-600">
                Grant and restrict features to owners, dispatchers, and employees securely.
              </p>
            </article>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white py-8">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-4 px-6 text-sm text-slate-600 sm:flex-row">
          <span>© {new Date().getFullYear()} FleetTrack. All rights reserved.</span>
          <div className="flex gap-4">
            <Link to="/login" className="hover:text-slate-900">
              Login
            </Link>
            <Link to="/register" className="hover:text-slate-900">
              Register
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
