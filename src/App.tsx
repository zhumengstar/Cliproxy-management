import { Suspense, lazy, useEffect } from 'react';
import { RouterProvider, createHashRouter } from 'react-router-dom';
import { NotificationContainer } from '@/components/common/NotificationContainer';
import { ConfirmationModal } from '@/components/common/ConfirmationModal';
import { useLanguageStore, useThemeStore } from '@/stores';

const MainLayout = lazy(() =>
  import('@/components/layout/MainLayout').then((mod) => ({ default: mod.MainLayout }))
);

function RootShell() {
  return (
    <>
      <NotificationContainer />
      <ConfirmationModal />
      <Suspense fallback={null}>
        <MainLayout />
      </Suspense>
    </>
  );
}

const router = createHashRouter([
  { path: '*', element: <RootShell /> },
]);

function App() {
  const initializeTheme = useThemeStore((state) => state.initializeTheme);
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);

  useEffect(() => {
    const cleanupTheme = initializeTheme();
    return cleanupTheme;
  }, [initializeTheme]);

  useEffect(() => {
    setLanguage(language);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 仅用于首屏同步 i18n 语言

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return <RouterProvider router={router} />;
}

export default App;
