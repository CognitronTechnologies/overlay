'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getProfile } from '../lib/auth';
import ThemeToggle from './ThemeToggle';

export default function SiteHeader() {
  const [role, setRole] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    getProfile()
      .then((p) => setRole(p?.role ?? null))
      .finally(() => setReady(true));
  }, []);

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="site-header">
      <div className="site-header__inner">

        {/* Brand */}
        <Link
          href="/"
          className="site-header__brand"
          onClick={closeMenu}
        >
          Overlay Bets
        </Link>


        {/* Mobile menu button */}
        <button
          type="button"
          className="nav-toggle"
          aria-expanded={menuOpen}
          aria-controls="primary-navigation"
          aria-label={
            menuOpen
              ? 'Close navigation menu'
              : 'Open navigation menu'
          }
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span aria-hidden="true">
            {menuOpen ? '\u2715' : '\u2630'}
          </span>
        </button>


        {/* Main navigation */}
        <nav
          id="primary-navigation"
          aria-label="Primary"
          className={menuOpen ? 'site-nav is-open' : 'site-nav'}
        >

          {/* Marketplace */}
          <Link
            href="/tipsters"
            onClick={closeMenu}
          >
            Tipsters
          </Link>


          {/* Acquisition funnel */}
          <Link
            href="/tips"
            onClick={closeMenu}
          >
            Free tips
          </Link>


          {/* Trust explanation */}
          <Link
            href="/how-it-works"
            onClick={closeMenu}
          >
            How it works
          </Link>


          {/* Resources */}
          <Link
            href="/blog"
            onClick={closeMenu}
          >
            Blog
          </Link>


          <Link
            href="/tools/odds-calculator"
            onClick={closeMenu}
          >
            Odds calculator
          </Link>


          {/* Logged-in user */}
          {role === 'user' ? (
            <Link
              href="/feed"
              onClick={closeMenu}
            >
              My feed
            </Link>
          ) : null}


          {/* Tipster workspace */}
          {role === 'tipster' ? (
            <>
              <Link
                href="/dashboard"
                onClick={closeMenu}
              >
                Dashboard
              </Link>

              <Link
                href="/earnings"
                onClick={closeMenu}
              >
                Earnings
              </Link>
            </>
          ) : null}


          {/* Admin */}
          {role === 'admin' ? (
            <Link
              href="/admin"
              onClick={closeMenu}
            >
              Admin
            </Link>
          ) : null}

        </nav>


        {/* Actions */}
        <div className="site-header__actions">

          <ThemeToggle />

          {ready ? (
            role ? (

              <Link
                href="/account"
                onClick={closeMenu}
              >
                Account
              </Link>

            ) : (

              <>
                <Link
                  href="/login"
                  onClick={closeMenu}
                >
                  Sign in
                </Link>

                <Link
                  href="/signup"
                  className="btn btn--primary"
                  onClick={closeMenu}
                >
                  Get started
                </Link>
              </>

            )
          ) : null}

        </div>

      </div>
    </header>
  );
}