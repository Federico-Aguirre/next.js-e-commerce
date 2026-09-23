'use client';

import { Search, ShoppingBag, UserRound } from 'lucide-react';
import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { signOutAction } from '@/actions/auth';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
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
  const [customUser, setCustomUser] = useState<{ id: string } | null>(null);
  const cartProductCount = useCartStore((state) => state.getCartCount());
  const productsPath = locale === 'es' ? '/es/products' : '/products';
  const localizedPath = (path: string) =>
    locale === 'es' ? `/es${path === '/' ? '' : path}` : path;
  const isAuthenticated = !!session?.user || !!customUser;
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') ?? '');
  const [cartHydrated, setCartHydrated] = useState(false);

  useEffect(() => {
    setCartHydrated(true);
    fetch('/api/auth/me')
      .then((response) => response.json())
      .then((data: { authenticated?: boolean; user?: { id: string } }) => {
        setCustomUser(data.authenticated && data.user ? data.user : null);
      })
      .catch(() => setCustomUser(null));
  }, []);

  useEffect(() => {
    if (isProductsPage) {
      setSearchQuery(searchParams.get('q') ?? '');
    }
  }, [isProductsPage, searchParams]);

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
  };

  const handleSignOut = async () => {
    await signOutAction();
    await signOut({ redirect: false });
    setCustomUser(null);
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
          className="hidden items-center gap-5 pl-4 text-sm font-medium text-muted-foreground lg:flex"
          aria-label={storeT.primaryNavigation}
        >
          <Link
            href={localizedPath('/')}
            className="transition hover:text-foreground"
          >
            {t.home_link}
          </Link>
          <Link
            href={localizedPath('/products')}
            className="transition hover:text-foreground"
          >
            {storeT.catalog}
          </Link>
          <Link
            href={localizedPath('/about')}
            className="transition hover:text-foreground"
          >
            {t.about_link}
          </Link>
          <Link
            href={localizedPath('/contact')}
            className="transition hover:text-foreground"
          >
            {t.contact_link}
          </Link>
        </nav>

        <div className="ml-auto hidden min-w-0 max-w-sm flex-1 md:block">
          <form
            action={productsPath}
            onSubmit={handleSearchSubmit}
            className="relative"
          >
            <label className="sr-only" htmlFor="header-search">
              {storeT.search}
            </label>
            <input
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
              className="h-10 w-full rounded-full border border-border bg-muted/60 pl-10 pr-4 text-sm outline-none transition focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary/20"
            />
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
          </form>
        </div>

        <div className="flex items-center gap-2">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="md:hidden"
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
            <Link href={localizedPath('/sign-in')}>
              <UserRound className="size-4" aria-hidden="true" />
            </Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            size="icon"
            aria-label={storeT.cart}
            title={storeT.cart}
          >
            <Link href="/cart" prefetch className="relative">
              <ShoppingBag className="size-4" aria-hidden="true" />
              {cartHydrated && cartProductCount > 0 && (
                <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold leading-4 text-primary-foreground">
                  {cartProductCount}
                </span>
              )}
            </Link>
          </Button>
          <LocaleSwitcher />
          <ThemeToggle />
          {status === 'loading' ? null : isAuthenticated ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleSignOut}
            >
              {t.sign_out_link}
            </Button>
          ) : (
            <Button asChild size="sm" className="hidden sm:inline-flex">
              <Link href={localizedPath('/sign-in')}>{t.sign_in_link}</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
