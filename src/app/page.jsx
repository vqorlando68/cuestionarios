'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCuestionariosContext } from '@/context/CuestionariosContext';

export default function Home() {
    const { initialized, user, login, loading, authError, t, language, setLanguage, theme, toggleTheme } = useCuestionariosContext();
    const [usuario, setUsuario] = useState('');
    const [clave, setClave] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const router = useRouter();

    useEffect(() => {
        if (initialized && user) {
            router.push('/admin/dashboard');
        }
    }, [initialized, user, router]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const res = await login(usuario, clave);
        if (res.success) {
            router.push('/admin/dashboard');
        }
    };

    if (!initialized || user) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#effaff] dark:bg-[#121212]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#ff7a39]"></div>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen relative overflow-hidden justify-center items-center p-4">
            {/* Top header navigation for language translation */}
            <header className="absolute top-4 right-4 flex gap-2 z-10">
                <button
                    onClick={() => setLanguage(language === 'es' ? 'en' : 'es')}
                    className="glass-panel px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all hover:border-[#ff7a39] text-slate-700 hover:text-white"
                >
                    {language === 'es' ? 'EN' : 'ES'}
                </button>
            </header>

            {/* Glowing background circles for Glassmorphism depth */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-400/20 blur-[120px] dark:bg-cyan-500/10 pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-orange-400/20 blur-[120px] dark:bg-orange-500/10 pointer-events-none" />

            {/* Login Card */}
            <div className="w-full max-w-md glass-panel p-8 md:p-10 z-10 transition-all border-[#b6ecff] dark:border-[#262626] shadow-2xl relative">
                {/* Logo Accent */}
                <div className="flex justify-center mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#ff7a39] to-[#ff5a1f] flex items-center justify-center shadow-lg shadow-orange-500/30">
                        <span className="text-white text-xl font-bold">T</span>
                    </div>
                </div>

                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold tracking-tight text-white dark:text-[#fafafa]">
                        Teker Apps
                    </h1>
                    <p className="text-sm mt-2 text-slate-400 dark:text-slate-400">
                        {t('cuestionarios')}
                    </p>
                </div>

                {authError && (
                    <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs text-center font-medium animate-pulse">
                        {authError === 'Usuario o clave incorrectos' ? t('error') + ': ' + authError : authError}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-xs font-semibold tracking-wider text-slate-500 uppercase mb-2">
                            {t('username')}
                        </label>
                        <input
                            type="text"
                            required
                            value={usuario}
                            onChange={(e) => setUsuario(e.target.value)}
                            placeholder="Ej. admin"
                            className="w-full px-4 py-3 rounded-xl bg-white/40 dark:bg-black/20 border border-[#b6ecff] dark:border-[#262626] text-white dark:text-[#fafafa] placeholder-slate-400 focus:outline-none focus:border-[#00aae1] focus:ring-2 focus:ring-[#00aae1]/20 transition-all text-sm font-medium"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold tracking-wider text-slate-500 uppercase mb-2">
                            {t('password')}
                        </label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                required
                                value={clave}
                                onChange={(e) => setClave(e.target.value)}
                                placeholder="••••••••"
                                className="w-full px-4 pr-12 py-3 rounded-xl bg-white/40 dark:bg-black/20 border border-[#b6ecff] dark:border-[#262626] text-white dark:text-[#fafafa] placeholder-slate-400 focus:outline-none focus:border-[#00aae1] focus:ring-2 focus:ring-[#00aae1]/20 transition-all text-sm font-medium"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors focus:outline-none"
                            >
                                {showPassword ? (
                                    <svg className="w-5 h-5 animate-fade-in" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7a10.024 10.024 0 014.168-5.262m2.42-1.724a10.114 10.114 0 013.954-1.014c4.478 0 8.268 2.943 9.542 7a10.025 10.025 0 01-4.132 5.4m-4.52-2.316A3 3 0 0012 9a3 3 0 00-3 3M3 3l18 18" />
                                    </svg>
                                ) : (
                                    <svg className="w-5 h-5 animate-fade-in" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#ff7a39] to-[#ff5a1f] hover:from-[#e06020] hover:to-[#e04a14] text-white font-bold text-sm tracking-wider uppercase shadow-lg shadow-orange-500/25 transition-all transform active:scale-[0.98] disabled:opacity-75 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                    >
                        {loading ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            t('login')
                        )}
                    </button>
                </form>
            </div>

            {/* Bottom theme toggler */}
            <button
                onClick={toggleTheme}
                className="absolute bottom-4 right-4 glass-panel px-4 py-2.5 text-xs font-semibold tracking-wider transition-all hover:border-[#ff7a39] flex items-center gap-2 text-slate-700 hover:text-white"
            >
                🌓 {theme === 'light' ? 'Modo Oscuro' : 'Modo Claro'}
            </button>
        </div>
    );
}
