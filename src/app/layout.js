'use client';

import { useEffect } from 'react';
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

export default function RootLayout({ children }) {
  
  useEffect(() => {
    
    const savedTheme = localStorage.getItem('theme');
    
    if (savedTheme === 'dark') {
      document.body.classList.add('dark');
    } else {
     
      document.body.classList.remove('dark');
    }
  }, []);

  return (
    <html 
      lang="tr" 
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <title>ProjeAdı | AI Destekli Araştırma Asistanı</title>
        <meta name="description" content="Yeni nesil araştırma deneyimine katılın." />
      </head>
      <body 
        className="min-h-full flex flex-col" 
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
