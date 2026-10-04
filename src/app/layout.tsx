import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '@/components/layout/Navbar';
import { MobileNav } from '@/components/layout/MobileNav';
import { Footer } from '@/components/layout/Footer';
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
    <html lang="es" className="dark">
      <body className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100 antialiased selection:bg-indigo-600 selection:text-white">
        <Navbar user={userProfile} />
        <main className="flex-1 pb-20 md:pb-8">{children}</main>
        <Footer />
        <MobileNav />
      </body>
    </html>
  );
}
