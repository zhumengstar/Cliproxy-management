import { lazy, type ComponentType } from 'react';
import { Navigate, useRoutes, type Location } from 'react-router-dom';

const lazyNamed = <TModule, TName extends keyof TModule>(
  loader: () => Promise<TModule>,
  name: TName
) =>
  lazy(async () => {
    const mod = await loader();
    return { default: mod[name] as ComponentType };
  });

const AccountPoolPage = lazyNamed(() => import('@/pages/AccountPoolPage'), 'AccountPoolPage');

const mainRoutes = [
  { path: '/', element: <Navigate to="/account-pool" replace /> },
  { path: '/account-pool', element: <AccountPoolPage /> },
  { path: '*', element: <Navigate to="/" replace /> },
];

export function MainRoutes({ location }: { location?: Location }) {
  return useRoutes(mainRoutes, location);
}
