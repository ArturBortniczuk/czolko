import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Gra w Zgadywanie Haseł',
  description: 'Zabawna gra online w zgadywanie haseł dla znajomych',
  keywords: 'gra, zgadywanie, hasła, zabawa, online',
  authors: [{ name: 'Twój Nick' }],
  openGraph: {
    title: 'Gra w Zgadywanie Haseł',
    description: 'Zabawna gra online w zgadywanie haseł dla znajomych',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  )
}