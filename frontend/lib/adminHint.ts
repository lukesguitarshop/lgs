/** Class on <html> that hides the free-shipping banner (see globals.css). */
export const ADMIN_CLASS = 'viewer-admin';

/** Class on <html> that swaps the storefront chrome for the seller portal's on /seller routes. */
export const SELLER_CLASS = 'viewer-seller';

/**
 * Runs in <head>, before first paint. The free-shipping banner is in the server HTML so
 * visitors get it with no layout shift, but the server cannot know who is looking — so
 * the owner would see it flash on every load until auth resolved. This reads the same
 * stored user AuthContext starts from and hides the banner up front when that user is
 * the admin. An impersonation tab keeps its own session in sessionStorage and is a
 * customer view. Lives outside the banner's 'use client' file so the server layout
 * imports a real string, not a client reference.
 */
export const ADMIN_HINT_SCRIPT = `try{var s=sessionStorage.getItem('impersonation')?sessionStorage:localStorage;var u=s.getItem('auth_token')&&JSON.parse(s.getItem('auth_user')||'null');if(u&&u.isAdmin&&!u.isGuest)document.documentElement.classList.add('${ADMIN_CLASS}');if(u&&u.isSeller&&!u.isGuest)document.documentElement.classList.add('${SELLER_CLASS}')}catch(e){}`;
