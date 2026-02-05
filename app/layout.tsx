import './globals.css'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'GenSnap - Secure Family Tree Manager',
  description: 'Build and preserve your family history with GenSnap. A secure, private, and easy-to-use family tree builder with photo uploads and relationship tracking.',
  keywords: ['Family Tree', 'Genealogy', 'GenSnap', 'Family History', 'Ancestry', 'Secure Database'],
  authors: [{ name: 'GenSnap Team' }],
  icons: {
    icon: '/favicon.ico',
  },
  verification: {
    google: 'SZ8Ojxb142LtFGK3yk8WKbyX13hmQEY4sRM9clSMokA',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}