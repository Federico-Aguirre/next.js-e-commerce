export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="w-full max-w-md rounded-2xl bg-card p-8 shadow-xl dark:ring-1 dark:ring-white/10">
        {children}
      </div>
    </div>
  );
}
