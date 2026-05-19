import Link from "next/link";
import { Code2, Github, ExternalLink } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-millennium-border bg-white mt-auto">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="py-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="col-span-1 sm:col-span-2 lg:col-span-1">
            <Link href="/" className="flex items-center gap-3">
              <div className="h-8 w-8 bg-millennium-cyan flex items-center justify-center">
                <Code2 className="h-4 w-4 text-white" strokeWidth={2.5} />
              </div>
              <span className="text-base font-black text-millennium-black tracking-tight">
                SWU OSR
              </span>
            </Link>
            <p className="mt-4 text-sm text-millennium-slate max-w-xs leading-relaxed">
              Open Source Repository — Platform mahasiswa untuk showcase karya,
              kolaborasi, dan membangun portofolio.
            </p>
          </div>

          {/* Platform */}
          <div>
            <h3 className="text-xs font-extrabold text-millennium-black uppercase tracking-widest mb-4">
              Platform
            </h3>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/"
                  className="text-sm text-millennium-slate hover:text-millennium-cyan transition-colors"
                >
                  Activity Feed
                </Link>
              </li>
              <li>
                <Link
                  href="/showcase"
                  className="text-sm text-millennium-slate hover:text-millennium-cyan transition-colors"
                >
                  Showcase
                </Link>
              </li>
              <li>
                <Link
                  href="/members"
                  className="text-sm text-millennium-slate hover:text-millennium-cyan transition-colors"
                >
                  Members
                </Link>
              </li>
            </ul>
          </div>

          {/* Organization */}
          <div>
            <h3 className="text-xs font-extrabold text-millennium-black uppercase tracking-widest mb-4">
              Organization
            </h3>
            <ul className="space-y-3">
              <li>
                <a
                  href="https://www.stmikwidyautama.ac.id"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-millennium-slate hover:text-millennium-cyan transition-colors flex items-center gap-1"
                >
                  STMIK Widya Utama
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>
                <span className="text-sm text-millennium-slate">
                  HMPSTI SWU
                </span>
              </li>
              <li>
                <span className="text-sm text-millennium-slate">
                  Teknik Informatika
                </span>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-xs font-extrabold text-millennium-black uppercase tracking-widest mb-4">
              Resources
            </h3>
            <ul className="space-y-3">
              <li>
                <a
                  href="https://github.com/FallCatsinSeng/SWU_OSR"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-millennium-slate hover:text-millennium-cyan transition-colors flex items-center gap-1"
                >
                  <Github className="h-3.5 w-3.5" />
                  Source Code
                </a>
              </li>
              <li>
                <Link
                  href="/login"
                  className="text-sm text-millennium-slate hover:text-millennium-cyan transition-colors"
                >
                  Get Started
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-millennium-border py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <p className="text-xs text-millennium-slate-mid">
            &copy; {new Date().getFullYear()} HMPSTI SWU — STMIK Widya Utama Purwokerto. Built with open source.
          </p>
          <a
            href="https://github.com/FallCatsinSeng/SWU_OSR"
            target="_blank"
            rel="noopener noreferrer"
            className="text-millennium-slate-mid hover:text-millennium-cyan transition-colors"
            aria-label="GitHub"
          >
            <Github className="h-4 w-4" />
          </a>
        </div>
      </div>
    </footer>
  );
}
