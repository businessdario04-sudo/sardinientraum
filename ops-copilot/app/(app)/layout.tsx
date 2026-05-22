import { AppProvider } from '@/lib/store';
import { Sidebar } from '@/components/layout/sidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar />
        <div className="flex flex-1 flex-col pl-60 min-w-0">
          {children}
        </div>
      </div>
    </AppProvider>
  );
}
