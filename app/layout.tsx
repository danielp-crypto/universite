import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Universite - AI Learning Assistant',
  description: 'AI Learning Assistant for Students',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
