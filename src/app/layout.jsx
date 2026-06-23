import { Inter } from 'next/font/google';
import { CuestionariosProvider } from '@/context/CuestionariosContext';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
    title: 'Plataforma de Evaluaciones y Cuestionarios — Teker Apps',
    description: 'Sistema de cuestionarios dinámicos con lógica condicional avanzada, editor visual interactivo y dashboard administrativo para encuestas y escalas médicas.',
    viewport: 'width=device-width, initial-scale=1',
};

export default function RootLayout({ children }) {
    return (
        <html lang="es" className="h-full">
            <body className={`${inter.className} min-h-full flex flex-col`}>
                <CuestionariosProvider>
                    {children}
                </CuestionariosProvider>
            </body>
        </html>
    );
}
