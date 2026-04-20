import Link from 'next/link';

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-ivory">
      {/* Top nav */}
      <nav className="container-academy flex items-center justify-between py-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-ink grid place-items-center">
            <span className="font-serif italic text-paper text-lg">M</span>
          </div>
          <div>
            <div className="font-serif text-lg text-ink leading-none">
              Michigan Elite
            </div>
            <div className="kicker mt-1">Sports Academy</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/sign-in" className="btn-secondary">
            Sign in
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="container-academy pt-16 pb-24 md:pt-24 md:pb-32">
        <div className="max-w-4xl">
          <div className="kicker mb-5">Est. 2024 · Michigan</div>
          <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl leading-[1.05] text-ink mb-8">
            A training platform built for{' '}
            <em className="italic text-crimson">serious hockey families</em>.
          </h1>
          <p className="text-lg md:text-xl text-ink-dim max-w-2xl leading-relaxed mb-10">
            One place for development tracking, goal management, coach
            assessments, and off-ice strength programming. Built for the players,
            parents, and coaches at MESA.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/sign-in" className="btn-primary">
              Sign in to your dashboard
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
            <a href="#features" className="btn-secondary">
              See what&apos;s inside
            </a>
          </div>
        </div>
      </section>

      {/* Rule */}
      <div className="container-academy">
        <div className="h-px bg-ink-hair" />
      </div>

      {/* Feature grid */}
      <section id="features" className="container-academy py-20 md:py-28">
        <div className="grid md:grid-cols-12 gap-12 md:gap-16">
          <div className="md:col-span-4">
            <div className="kicker mb-4">The platform</div>
            <h2 className="font-serif text-4xl md:text-5xl text-ink leading-[1.1]">
              Everything a player, parent, or coach needs — in one place.
            </h2>
          </div>
          <div className="md:col-span-8 grid sm:grid-cols-2 gap-8">
            <Feature
              number="01"
              title="Development Tracking"
              body="Monthly coach-issued ratings across technical, tactical, physical, mental, and compete dimensions. Trends visible at a glance."
            />
            <Feature
              number="02"
              title="Goal Management"
              body="Every player sets individual goals with progress tracked toward season-long targets. Coaches can add supporting checkpoints."
            />
            <Feature
              number="03"
              title="Strength & Conditioning"
              body="Off-ice program cycles with PR tracking and phase-based progression. Works for any age group, any equipment level."
            />
            <Feature
              number="04"
              title="Practice & Game Logs"
              body="Coaches log practices from the drill library and post-game stats. Parents and players see attendance and performance history."
            />
            <Feature
              number="05"
              title="Drill Library"
              body="Academy-wide library of drills organized by category, age group, and focus area. Coaches build practice plans in minutes."
            />
            <Feature
              number="06"
              title="Activity Sync"
              body="Manual activity logs today, with Apple Watch heart rate and workout data sync coming soon. Your training history, your phone."
            />
          </div>
        </div>
      </section>

      {/* Personas strip */}
      <section className="bg-sand-50 py-20 md:py-28">
        <div className="container-academy">
          <div className="kicker mb-4">Who it&apos;s for</div>
          <h2 className="font-serif text-4xl md:text-5xl text-ink leading-[1.1] mb-14 max-w-3xl">
            Different experiences, one shared system.
          </h2>
          <div className="grid md:grid-cols-4 gap-6">
            <Persona
              role="Players"
              line="See your goals, ratings, and training load — all in one dashboard."
            />
            <Persona
              role="Parents"
              line="Track your children&apos;s progress, practices, and billing from one family account."
            />
            <Persona
              role="Coaches"
              line="Log games, rate players, build practice plans, manage teams."
            />
            <Persona
              role="Director"
              line="Academy-wide visibility across every team, coach, and athlete."
            />
          </div>
        </div>
      </section>

      {/* CTA band */}
      <section className="container-academy py-20 md:py-28">
        <div className="max-w-3xl">
          <h2 className="font-serif text-4xl md:text-5xl text-ink leading-[1.1] mb-6">
            Already have an invite?{' '}
            <em className="italic text-crimson">Head to sign-in.</em>
          </h2>
          <p className="text-lg text-ink-dim mb-8">
            New families and coaches join by email invite from the academy. If
            you&apos;re expecting one and haven&apos;t received it, check your
            spam folder or reach out to the front office.
          </p>
          <Link href="/sign-in" className="btn-primary">
            Sign in
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-ink-hair bg-paper">
        <div className="container-academy py-10 flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-ink grid place-items-center">
              <span className="font-serif italic text-paper text-sm">M</span>
            </div>
            <span className="text-sm text-ink-dim">
              Michigan Elite Sports Academy · © 2024
            </span>
          </div>
          <div className="flex gap-6 text-sm text-ink-faint">
            <a className="hover:text-ink cursor-pointer">Privacy</a>
            <a className="hover:text-ink cursor-pointer">Terms</a>
            <a className="hover:text-ink cursor-pointer">Support</a>
          </div>
        </div>
      </footer>
    </main>
  );
}

function Feature({
  number,
  title,
  body,
}: {
  number: string;
  title: string;
  body: string;
}) {
  return (
    <div className="border-t border-ink-hair pt-6">
      <div className="font-mono text-xs text-ink-faint tracking-[0.18em] mb-3">
        {number}
      </div>
      <h3 className="font-serif text-2xl text-ink mb-2">{title}</h3>
      <p className="text-[15px] text-ink-dim leading-relaxed">{body}</p>
    </div>
  );
}

function Persona({ role, line }: { role: string; line: string }) {
  return (
    <div className="bg-paper border border-ink-hair rounded-2xl p-6">
      <div className="kicker mb-3">Role</div>
      <div className="font-serif text-2xl text-ink mb-3">{role}</div>
      <p className="text-sm text-ink-dim leading-relaxed">{line}</p>
    </div>
  );
}
