import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Money App",
  description: "ระบบจัดการสินเชื่อ",
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'Money',
    statusBarStyle: 'black-translucent',
  },
  icons: {
    apple: '/apple-touch-icon.png',
    icon: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'Money App',
    description: 'ระบบจัดการสินเชื่อ',
    siteName: 'Money App',
    images: [
      {
        url: 'https://job-project-loans.vercel.app/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Money App',
      },
    ],
    locale: 'th_TH',
    type: 'website',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('loan_theme');if(t==='light')document.documentElement.setAttribute('data-theme','light');}catch(e){}` }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
