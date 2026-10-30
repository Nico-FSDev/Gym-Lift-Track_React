import { useAuth } from './hooks/useAuth';
import Dashboard from './components/Dashboard';
import LoginScreen from './components/LoginScreen';

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950 transition-colors">
        <div className="w-12 h-12 border-4 border-gray-200 dark:border-slate-800 border-t-black dark:border-t-white rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-slate-100 font-sans selection:bg-gray-200 dark:selection:bg-slate-800 pb-20 transition-colors">
      <Dashboard />
    </div>
  );
}

