'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { translations } from '../translations';

const CuestionariosContext = createContext();

export function CuestionariosProvider({ children }) {
    // Localization
    const [language, setLanguage] = useState('es');
    
    // Theme Mode
    const [theme, setTheme] = useState('light');

    // Authentication / Session
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(false);
    const [authError, setAuthError] = useState('');
    const [initialized, setInitialized] = useState(false);

    // Global Data
    const [cuestionarios, setCuestionarios] = useState([]);
    const [currentCuestionario, setCurrentCuestionario] = useState(null);

    // Initial load for local states (runs only on client-side after mount to prevent hydration mismatch)
    useEffect(() => {
        const loadSaved = () => {
            const savedLang = localStorage.getItem('cuest_lang');
            if (savedLang) setLanguage(savedLang);

            const savedTheme = localStorage.getItem('cuest_theme') || 'light';
            setTheme(savedTheme);
            if (savedTheme === 'dark') {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }

            const savedUser = localStorage.getItem('cuest_user');
            if (savedUser) {
                try {
                    setUser(JSON.parse(savedUser));
                } catch (e) {
                    localStorage.removeItem('cuest_user');
                }
            }
            setInitialized(true);
        };
        // Defer execution using setTimeout to satisfy synchronous set-state linter check
        const timer = setTimeout(loadSaved, 0);
        return () => clearTimeout(timer);
    }, []);

    // Synchronize HTML classes when theme state changes in client-side
    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [theme]);

    // Translate helper
    const t = useCallback((key) => {
        if (!translations[language]) return key;
        return translations[language][key] || key;
    }, [language]);

    // Toggle Light/Dark Theme
    const toggleTheme = useCallback(() => {
        const newTheme = theme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
        localStorage.setItem('cuest_theme', newTheme);
        if (newTheme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [theme]);

    // Change language
    const changeLanguage = useCallback((lang) => {
        setLanguage(lang);
        localStorage.setItem('cuest_lang', lang);
    }, []);

    // Log In Auth
    const login = useCallback(async (usuario, clave) => {
        setLoading(true);
        setAuthError('');
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ usuario, clave })
            });
            const data = await res.json();
            if (data.success) {
                const userData = { usuario: data.usuario, rol: data.rol, token: data.token };
                setUser(userData);
                localStorage.setItem('cuest_user', JSON.stringify(userData));
                return { success: true };
            } else {
                setAuthError(data.error || 'Invalid credentials');
                return { success: false, error: data.error };
            }
        } catch (err) {
            console.error('Error during login:', err);
            setAuthError('Connection error. Try again.');
            return { success: false, error: 'Connection error' };
        } finally {
            setLoading(false);
        }
    }, []);

    // Log Out
    const logout = useCallback(() => {
        setUser(null);
        localStorage.removeItem('cuest_user');
    }, []);

    // Fetch all questionnaires
    const fetchCuestionarios = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/cuestionarios');
            const data = await res.json();
            if (data.success) {
                setCuestionarios(data.data || []);
                return data.data;
            } else {
                console.error(data.error);
                return [];
            }
        } catch (err) {
            console.error('Failed to fetch questionnaires:', err);
            return [];
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch detailed questionnaire by ID
    const fetchCuestionarioDetalle = useCallback(async (id) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/cuestionarios?id=${id}`);
            const data = await res.json();
            if (data.success) {
                setCurrentCuestionario(data.data);
                return data.data;
            } else {
                console.error(data.error);
                return null;
            }
        } catch (err) {
            console.error(`Failed to fetch questionnaire ${id}:`, err);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    // Save Questionnaire structure
    const saveCuestionario = useCallback(async (cuestionarioData) => {
        setLoading(true);
        try {
            const res = await fetch('/api/cuestionarios', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(cuestionarioData)
            });
            const data = await res.json();
            if (data.success) {
                await fetchCuestionarios(); // Refresh list
                return { success: true, id: data.id, version: data.version };
            } else {
                return { success: false, error: data.error };
            }
        } catch (err) {
            console.error('Failed to save questionnaire:', err);
            return { success: false, error: 'Connection error' };
        } finally {
            setLoading(false);
        }
    }, [fetchCuestionarios]);

    // Change status / publish / delete
    const changeEstadoCuestionario = useCallback(async (id, accion) => {
        setLoading(true);
        try {
            const res = await fetch('/api/cuestionarios', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, accion })
            });
            const data = await res.json();
            if (data.success) {
                await fetchCuestionarios(); // Refresh list
                return { success: true };
            } else {
                return { success: false, error: data.error };
            }
        } catch (err) {
            console.error('Failed to change status:', err);
            return { success: false, error: 'Connection error' };
        } finally {
            setLoading(false);
        }
    }, [fetchCuestionarios]);

    // Duplicate Questionnaire
    const duplicateCuestionario = useCallback(async (id, nuevoNombre) => {
        setLoading(true);
        try {
            const res = await fetch('/api/cuestionarios/duplicar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, nuevo_nombre: nuevoNombre })
            });
            const data = await res.json();
            if (data.success) {
                await fetchCuestionarios(); // Refresh list
                return { success: true, id: data.id };
            } else {
                return { success: false, error: data.error };
            }
        } catch (err) {
            console.error('Failed to duplicate questionnaire:', err);
            return { success: false, error: 'Connection error' };
        } finally {
            setLoading(false);
        }
    }, [fetchCuestionarios]);

    // Start a response
    const iniciarRespuesta = useCallback(async (idCuestionario, idUsuario = null) => {
        try {
            const res = await fetch('/api/respuestas/iniciar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id_cuestionario: idCuestionario, id_usuario: idUsuario })
            });
            const data = await res.json();
            return data;
        } catch (err) {
            console.error('Failed to start response:', err);
            return { success: false, error: 'Connection error' };
        }
    }, []);

    // Save temporary / final answers
    const guardarRespuestas = useCallback(async (idRespuesta, respuestasList) => {
        try {
            const res = await fetch('/api/respuestas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id_cuestionario_respuesta: idRespuesta, respuestas: respuestasList })
            });
            const data = await res.json();
            return data;
        } catch (err) {
            console.error('Failed to save answers:', err);
            return { success: false, error: 'Connection error' };
        }
    }, []);

    // Finalize response (calculates score and classifications)
    const finalizarCuestionario = useCallback(async (idRespuesta) => {
        try {
            const res = await fetch(`/api/respuestas/finalizar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id_cuestionario_respuesta: idRespuesta })
            });
            const data = await res.json();
            return data;
        } catch (err) {
            console.error('Failed to finalize questionnaire:', err);
            return { success: false, error: 'Connection error' };
        }
    }, []);

    // Save final survey response as a CLOB JSON
    const guardarJsonRespuesta = useCallback(async (idRespuesta, exportObj) => {
        try {
            const res = await fetch('/api/respuestas/guardar_json', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id_cuestionario_respuesta: idRespuesta, entrada_clob: exportObj })
            });
            const data = await res.json();
            return data;
        } catch (err) {
            console.error('Failed to save clob JSON:', err);
            return { success: false, error: 'Connection error' };
        }
    }, []);

    // Fetch detailed answers by Response ID
    const fetchRespuestaDetalle = useCallback(async (idRespuesta) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/respuestas?id=${idRespuesta}`);
            const data = await res.json();
            if (data.success) {
                return data.data;
            } else {
                console.error(data.error);
                return null;
            }
        } catch (err) {
            console.error(`Failed to fetch response detail ${idRespuesta}:`, err);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch admin dashboard aggregated stats
    const fetchDashboardStats = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/dashboard');
            const data = await res.json();
            if (data.success) {
                return data;
            } else {
                console.error(data.error);
                return null;
            }
        } catch (err) {
            console.error('Failed to fetch dashboard stats:', err);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    // Custom Dialog State
    const [dialog, setDialog] = useState(null);

    const customAlert = useCallback((message) => {
        return new Promise((resolve) => {
            setDialog({
                type: 'alert',
                message,
                resolve: (val) => {
                    resolve(val);
                    setDialog(null);
                }
            });
        });
    }, []);

    const customConfirm = useCallback((message) => {
        return new Promise((resolve) => {
            setDialog({
                type: 'confirm',
                message,
                resolve: (val) => {
                    resolve(val);
                    setDialog(null);
                }
            });
        });
    }, []);

    const customPrompt = useCallback((message, defaultValue = '') => {
        return new Promise((resolve) => {
            setDialog({
                type: 'prompt',
                message,
                defaultValue,
                resolve: (val) => {
                    resolve(val);
                    setDialog(null);
                }
            });
        });
    }, []);

    return (
        <CuestionariosContext.Provider value={{
            initialized,
            alert: customAlert,
            confirm: customConfirm,
            prompt: customPrompt,
            language,
            setLanguage: changeLanguage,
            t,
            theme,
            toggleTheme,
            user,
            loading,
            authError,
            login,
            logout,
            cuestionarios,
            currentCuestionario,
            setCurrentCuestionario,
            fetchCuestionarios,
            fetchCuestionarioDetalle,
            saveCuestionario,
            changeEstadoCuestionario,
            duplicateCuestionario,
            iniciarRespuesta,
            guardarRespuestas,
            finalizarCuestionario,
            guardarJsonRespuesta,
            fetchRespuestaDetalle,
            fetchDashboardStats
        }}>
            {children}
            {dialog && (
                <CustomModalDialog
                    type={dialog.type}
                    message={dialog.message}
                    defaultValue={dialog.defaultValue}
                    resolve={dialog.resolve}
                    language={language}
                    theme={theme}
                />
            )}
        </CuestionariosContext.Provider>
    );
}

export function useCuestionariosContext() {
    const context = useContext(CuestionariosContext);
    if (!context) {
        throw new Error('useCuestionariosContext must be used within a CuestionariosProvider');
    }
    return context;
}

function CustomModalDialog({ type, message, defaultValue = '', resolve, language, theme }) {
    const [inputValue, setInputValue] = useState(defaultValue);

    // translations
    const tAlert = language === 'es' ? 'Mensaje del Sistema' : 'System Message';
    const tConfirm = language === 'es' ? 'Confirmación' : 'Confirmation';
    const tPrompt = language === 'es' ? 'Entrada Requerida' : 'Input Required';
    const tAccept = language === 'es' ? 'Aceptar' : 'Accept';
    const tCancel = language === 'es' ? 'Cancelar' : 'Cancel';

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[9999] animate-fade-in no-print">
            <div className="w-full max-w-md glass-panel p-6 border-[#b6ecff] dark:border-[#262626] space-y-6 shadow-2xl relative animate-scale-up">
                
                {/* Header */}
                <div className="flex items-center justify-between border-b border-[#b6ecff]/10 pb-3">
                    <h3 className="text-sm font-extrabold uppercase tracking-widest text-[#00aae1] dark:text-[#06b6d4]">
                        {type === 'alert' ? tAlert : type === 'confirm' ? tConfirm : tPrompt}
                    </h3>
                    <button 
                        onClick={() => resolve(type === 'prompt' ? null : false)}
                        className="text-slate-400 hover:text-white dark:hover:text-white text-lg font-bold transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* Body */}
                <div className="py-2">
                    <p className="text-sm font-semibold text-white dark:text-[#fafafa] whitespace-pre-wrap leading-relaxed">
                        {message}
                    </p>
                </div>

                {/* Prompt input */}
                {type === 'prompt' && (
                    <div className="pt-2">
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            autoFocus
                            className="w-full px-4 py-2.5 rounded-lg bg-white/40 dark:bg-black/20 border border-[#b6ecff] dark:border-[#262626] text-white dark:text-[#fafafa] placeholder-slate-400 focus:outline-none focus:border-[#00aae1] focus:ring-1 focus:ring-[#00aae1] transition-all text-sm font-medium"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    resolve(inputValue);
                                }
                            }}
                        />
                    </div>
                )}

                {/* Footer Buttons */}
                <div className="flex gap-2 justify-end pt-3 border-t border-[#b6ecff]/10">
                    {type !== 'alert' && (
                        <button
                            type="button"
                            onClick={() => resolve(type === 'prompt' ? null : false)}
                            className="px-4 py-2 rounded-lg border border-[#b6ecff] dark:border-[#262626] hover:border-red-500 hover:text-red-500 text-xs font-bold uppercase transition-all"
                        >
                            {tCancel}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => resolve(type === 'prompt' ? inputValue : true)}
                        className="px-5 py-2 rounded-lg bg-gradient-to-r from-[#ff7a39] to-[#ff5a1f] hover:from-[#e06020] hover:to-[#e04a14] text-white font-bold text-xs uppercase tracking-wider shadow-md transition-all active:scale-[0.98]"
                    >
                        {tAccept}
                    </button>
                </div>

            </div>
        </div>
    );
}
