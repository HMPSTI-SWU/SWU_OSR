import Link from 'next/link';
import Image from 'next/image';
import { Github, ExternalLink } from 'lucide-react';
import logoOrbit from '@/assets/logo orbit.png';

export function Footer() {
  return (
    <footer className="border-t border-geist-hairline bg-geist-canvas mt-auto dark:border-neutral-800 dark:bg-black">
      <div className="mx-auto max-w-geist-page px-6">
        {/* 4-column footer grid */}
        <div className="py-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 sm:col-span-2 lg:col-span-1">
            <Link href="/feed" className="flex items-center gap-2">
              <Image
                src={logoOrbit}
                alt="ORBIT Logo"
                width={28}
                height={28}
                className="dark:invert"
              />
              <span className="text-body-sm-strong text-geist-ink dark:text-white">ORBIT</span>
            </Link>
            <p className="mt-3 text-body-sm text-geist-body dark:text-white max-w-xs">
              Open Source Repository — Platform mahasiswa untuk showcase karya, kolaborasi, dan
              membangun portofolio.
            </p>
          </div>

          {/* Platform — mono eyebrow label */}
          <div>
            <h3 className="text-caption-mono text-geist-mute dark:text-white uppercase mb-3">
              Platform
            </h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/feed"
                  className="text-body-sm text-geist-body hover:text-geist-ink transition-colors dark:text-white dark:hover:text-white"
                >
                  Activity Feed
                </Link>
              </li>
              <li>
                <Link
                  href="/showcase"
                  className="text-body-sm text-geist-body hover:text-geist-ink transition-colors dark:text-white dark:hover:text-white"
                >
                  Showcase
                </Link>
              </li>
              <li>
                <Link
                  href="/members"
                  className="text-body-sm text-geist-body hover:text-geist-ink transition-colors dark:text-white dark:hover:text-white"
                >
                  Members
                </Link>
              </li>
            </ul>
          </div>

          {/* Organization — mono eyebrow */}
          <div>
            <h3 className="text-caption-mono text-geist-mute dark:text-white uppercase mb-3">
              Organization
            </h3>
            <ul className="space-y-2">
              <li>
                <a
                  href="https://www.swu.ac.id"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-body-sm text-geist-body hover:text-geist-ink transition-colors inline-flex items-center gap-1 dark:text-white dark:hover:text-white"
                >
                  STMIK Widya Utama
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>
                <span className="text-body-sm text-geist-body dark:text-white">HMPSTI SWU</span>
              </li>
              <li>
                <span className="text-body-sm text-geist-body dark:text-white">
                  Teknik Informatika
                </span>
              </li>
            </ul>
          </div>

          {/* Resources — mono eyebrow */}
          <div>
            <h3 className="text-caption-mono text-geist-mute dark:text-white uppercase mb-3">
              Resources
            </h3>
            <ul className="space-y-2">
              <li>
                <a
                  href="https://github.com/FallCatsinSeng/SWU_OSR"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-body-sm text-geist-body hover:text-geist-ink transition-colors inline-flex items-center gap-1 dark:text-white dark:hover:text-white"
                >
                  <Github className="h-3 w-3" />
                  Source Code
                </a>
              </li>
              <li>
                <Link
                  href="/login"
                  className="text-body-sm text-geist-body hover:text-geist-ink transition-colors dark:text-white dark:hover:text-white"
                >
                  Get Started
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar — hairline separator */}
        <div className="border-t border-geist-hairline dark:border-neutral-800 py-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-caption text-geist-mute dark:text-white">
            &copy; {new Date().getFullYear()} HMPSTI SWU — STMIK Widya Utama Purwokerto. Built with
            open source.
          </p>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/FallCatsinSeng/SWU_OSR"
              target="_blank"
              rel="noopener noreferrer"
              className="text-geist-mute hover:text-geist-ink transition-colors dark:text-white dark:hover:text-white"
              aria-label="GitHub"
            >
              <Github className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
