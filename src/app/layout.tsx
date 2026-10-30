import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'PLEASE DO NOT REMAIN HERE', description: 'Your objective: remain here. Its objective: make you leave.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
