'use client';

import { Menu, Search, ShoppingBag, UserRound, X } from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import enMessages from '@/locales/en.json';
import esMessages from '@/locales/es.json';
import { useCartStore } from '@/store/useCartStore';

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = pathname.startsWith('/es') ? 'es' : 'en';
  const isProductsPage = /^\/(?:es\/)?products(?:\/|$)/.test(pathname);
  const messages = locale === 'es' ? esMessages : enMessages;
  const t = messages.RootLayout;
  const storeT = messages.Storefront.nav;
  const { data: session, status } = useSession();
  const cartProductCount = useCartStore((state) => state.getCartCount());
  const productsPath = locale === 'es' ? '/es/products' : '/products';
  const localizedPath = (path: string) =>
    locale === 'es' ? `/es${path === '/' ? '' : path}` : path;
  const isAuthenticated = !!session?.user;
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') ?? '');
  const [cartHydrated, setCartHydrated] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const previousPathname = useRef(pathname);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  useEffect(() => {
    queueMicrotask(() => {
      setCartHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (isProductsPage) {
      const query = searchParams.get('q') ?? '';
      queueMicrotask(() => {
        setSearchQuery(query);
      });
    }
  }, [isProductsPage, searchParams]);

  useEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    queueMicrotask(() => {
      setMobileMenuOpen(false);
    });
  }, [pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenuOpen(false);
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [mobileMenuOpen]);

  const updateProductsSearch = (value: string) => {
    setSearchQuery(value);
    const params = new URLSearchParams(searchParams.toString());

    if (value.trim()) {
      params.set('q', value);
    } else {
      params.delete('q');
    }

    params.delete('page');
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  };

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    if (isProductsPage) {
      event.preventDefault();
    }
    setMobileMenuOpen(false);
  };

  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push(localizedPath('/'));
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/80 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href={localizedPath('/')}
          className="group shrink-0 text-base font-semibold tracking-tight sm:text-lg"
        >
          NOVA
          <span className="text-primary transition-colors duration-300 group-hover:text-foreground">
            {' '}
            STORE
          </span>
        </Link>

        <nav
          className="hidden items-center gap-4 pl-3 text-sm font-medium text-muted-foreground xl:flex 2xl:gap-5 2xl:pl-4"
          aria-label={storeT.primaryNavigation}
        >
          <Link href={localizedPath('/')} className="transition hover:text-foreground">
            {t.home_link}
          </Link>
          <Link href={localizedPath('/products')} className="transition hover:text-foreground">
            {storeT.catalog}
          </Link>
          <Link href={localizedPath('/about')} className="transition hover:text-foreground">
            {t.about_link}
          </Link>
          <Link href={localizedPath('/contact')} className="transition hover:text-foreground">
            {t.contact_link}
          </Link>
          <Link href={localizedPath('/support')} className="transition hover:text-foreground">
            {t.support_link}
          </Link>
          <Link href={localizedPath('/historial')} className="transition hover:text-foreground">
            Historial
          </Link>
          {isAuthenticated && session?.user?.isAdmin && (
            <Link href={localizedPath('/dashboard')} className="transition hover:text-foreground">
              {t.dashboard_link}
            </Link>
          )}
          {isAuthenticated && session?.user?.isPlatformOwner === true && (
            <Link href={localizedPath('/developer')} className="transition hover:text-foreground">
              {t.developer_link}
            </Link>
          )}
        </nav>

        <div className="hidden max-w-sm min-w-0 flex-1 xl:block">
          <form action={productsPath} onSubmit={handleSearchSubmit} className="relative">
            <label className="sr-only" htmlFor="header-search">
              {storeT.search}
            </label>
            <Input
              id="header-search"
              name="q"
              placeholder={storeT.searchPlaceholder}
              value={searchQuery}
              onChange={(event) => {
                if (isProductsPage) {
                  updateProductsSearch(event.target.value);
                } else {
                  setSearchQuery(event.target.value);
                }
              }}
              className="h-10 w-full rounded-full border border-border bg-muted/60 pr-4 pl-10 text-sm transition outline-none focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary/20"
            />
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
          </form>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2 xl:ml-0">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="xl:hidden"
            aria-label={storeT.search}
          >
            <Link href={localizedPath('/products')}>
              <Search className="size-4" aria-hidden="true" />
            </Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            size="icon"
            aria-label={storeT.account}
            title={storeT.account}
          >
            <Link href={localizedPath(isAuthenticated ? '/account' : '/sign-in')}>
              <UserRound className="size-4" aria-hidden="true" />
            </Link>
          </Button>
          <Button asChild variant="ghost" size="icon" aria-label={storeT.cart} title={storeT.cart}>
            <Link href="/cart" prefetch className="relative">
              <ShoppingBag className="size-4" aria-hidden="true" />
              {cartHydrated && cartProductCount > 0 && (
                <span className="absolute -top-1 -right-1 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] leading-4 font-bold text-primary-foreground">
                  {cartProductCount}
                </span>
              )}
            </Link>
          </Button>
          <div className="hidden items-center gap-2 xl:flex">
            <LocaleSwitcher />
            <ThemeToggle />
            {status === 'loading' ? null : isAuthenticated ? (
              <Button type="button" variant="secondary" size="sm" onClick={handleSignOut}>
                {t.sign_out_link}
              </Button>
            ) : (
              <Button asChild size="sm">
                <Link href={localizedPath('/sign-in')}>{t.sign_in_link}</Link>
              </Button>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="xl:hidden"
            aria-label={mobileMenuOpen ? storeT.closeMenu : storeT.openMenu}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMobileMenuOpen((open) => !open)}
          >
            {mobileMenuOpen ? (
              <X className="size-5" aria-hidden="true" />
            ) : (
              <Menu className="size-5" aria-hidden="true" />
            )}
          </Button>
        </div>
      </div>
      <div
        id="mobile-navigation"
        className={`${mobileMenuOpen ? 'block' : 'hidden'} border-t border-border bg-background/95 backdrop-blur-xl xl:hidden`}
        aria-hidden={!mobileMenuOpen}
      >
        <div className="mx-auto max-w-7xl space-y-4 px-4 py-4 sm:px-6 lg:px-8">
          <form action={productsPath} onSubmit={handleSearchSubmit} className="relative">
            <label className="sr-only" htmlFor="header-mobile-search">
              {storeT.search}
            </label>
            <Input
              id="header-mobile-search"
              name="q"
              placeholder={storeT.searchPlaceholder}
              value={searchQuery}
              onChange={(event) => {
                if (isProductsPage) {
                  updateProductsSearch(event.target.value);
                } else {
                  setSearchQuery(event.target.value);
                }
              }}
              className="h-11 w-full rounded-lg border border-border bg-muted/60 pr-4 pl-10 text-sm outline-none focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary/20"
            />
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
          </form>

          <nav
            className="grid gap-1 text-sm font-medium text-foreground"
            aria-label={storeT.primaryNavigation}
          >
            <Link
              href={localizedPath('/')}
              onClick={closeMobileMenu}
              className="rounded-lg px-3 py-2.5 transition hover:bg-muted"
            >
              {t.home_link}
            </Link>
            <Link
              href={localizedPath('/products')}
              onClick={closeMobileMenu}
              className="rounded-lg px-3 py-2.5 transition hover:bg-muted"
            >
              {storeT.catalog}
            </Link>
            <Link
              href={localizedPath('/about')}
              onClick={closeMobileMenu}
              className="rounded-lg px-3 py-2.5 transition hover:bg-muted"
            >
              {t.about_link}
            </Link>
            <Link
              href={localizedPath('/contact')}
              onClick={closeMobileMenu}
              className="rounded-lg px-3 py-2.5 transition hover:bg-muted"
            >
              {t.contact_link}
            </Link>
            <Link
              href={localizedPath('/support')}
              onClick={closeMobileMenu}
              className="rounded-lg px-3 py-2.5 transition hover:bg-muted"
            >
              {t.support_link}
            </Link>
            <Link
              href={localizedPath('/historial')}
              onClick={closeMobileMenu}
              className="rounded-lg px-3 py-2.5 transition hover:bg-muted"
            >
              {storeT.history}
            </Link>
            {isAuthenticated && session?.user?.isAdmin && (
              <Link
                href={localizedPath('/dashboard')}
                onClick={closeMobileMenu}
                className="rounded-lg px-3 py-2.5 transition hover:bg-muted"
              >
                {t.dashboard_link}
              </Link>
            )}
            {isAuthenticated && session?.user?.isPlatformOwner === true && (
              <Link
                href={localizedPath('/developer')}
                onClick={closeMobileMenu}
                className="rounded-lg px-3 py-2.5 transition hover:bg-muted"
              >
                {t.developer_link}
              </Link>
            )}
          </nav>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={localizedPath(isAuthenticated ? '/account' : '/sign-in')}
                onClick={closeMobileMenu}
                className="rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-muted"
              >
                {storeT.account}
              </Link>
              {status === 'loading' ? null : isAuthenticated ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    closeMobileMenu();
                    void handleSignOut();
                  }}
                >
                  {t.sign_out_link}
                </Button>
              ) : (
                <Link
                  href={localizedPath('/sign-in')}
                  onClick={closeMobileMenu}
                  className="rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-muted"
                >
                  {t.sign_in_link}
                </Link>
              )}
            </div>
            <div className="flex items-center gap-2">
              <LocaleSwitcher />
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
