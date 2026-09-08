import { useEffect, useState } from 'react';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { router } from './routes/AppRoutes';
import { LoadingScreen } from './components/common/LoadingScreen';

// Minimum time the splash stays up so it reads as an intentional brand
// moment rather than a flash, even on a fast connection. Real bootstrap
// work (session restore) runs in parallel inside AuthProvider.
const MIN_SPLASH_MS = 1100;

export default function App() {
  const [isBooting, setIsBooting] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsBooting(false), MIN_SPLASH_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AuthProvider>
      <ToastProvider>
        {isBooting && <LoadingScreen />}
        <div className={isBooting ? 'invisible' : 'visible'}>
          <RouterProvider router={router} />
        </div>
      </ToastProvider>
    </AuthProvider>
  );
}