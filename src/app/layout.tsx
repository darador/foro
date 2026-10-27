import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '@/components/layout/Navbar';
import { MobileNav } from '@/components/layout/MobileNav';
import { Footer } from '@/components/layout/Footer';
import { ThemeProvider } from '@/components/common/ThemeProvider';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'ForoFetiche — Comunidad adulta anónima',
  description: 'Comunidad anónima y discreta para adultos (+18) sobre sexualidad, fetiches y conversaciones adultas.',
  robots: {
    index: true,
    follow: true,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let userProfile = null;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('alias, email_verified')
        .eq('id', user.id)
        .single();

      userProfile = profile;
    }
  } catch {
    // Graceful fallback if Supabase env vars are not set during initial build
  }

  return (
    <html lang="es" suppressHydrationWarning className="dark">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('forofetiche-theme');
                  var isLight = stored === 'light' || (stored === 'system' && !window.matchMedia('(prefers-color-scheme: dark)').matches);
                  if (isLight) {
                    document.documentElement.classList.remove('dark');
                    document.documentElement.classList.add('light');
                  } else {
                    document.documentElement.classList.add('dark');
                    document.documentElement.classList.remove('light');
                  }
                } catch (e) {
                  document.documentElement.classList.add('dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body className="flex min-h-screen flex-col bg-[var(--bg-primary)] text-[var(--text-primary)] antialiased transition-colors duration-150">
        <ThemeProvider>
          <Navbar user={userProfile} />
          <main className="flex-1 pb-20 md:pb-12">{children}</main>
          <Footer />
          <MobileNav />
        </ThemeProvider>
      </body>
    </html>
  );
}
