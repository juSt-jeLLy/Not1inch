import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import "@mysten/dapp-kit/dist/index.css";
import { headers } from 'next/headers'; // added
import ContextProvider from '@/context'; // added
import { ToastContainer } from 'react-toastify';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Not1inch", // updated
  description: "cross chain swap", // updated
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersObj = await headers(); // added
  const cookies = headersObj.get('cookie'); // added

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <Providers>
        <ContextProvider cookies={cookies}> {/* added wrapper */}
          
            {children}
          <ToastContainer/>
        </ContextProvider> {/* added wrapper */}
        </Providers>
      </body>
    </html>
  );
}