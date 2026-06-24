'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useCuestionariosContext } from '@/context/CuestionariosContext';

export default function ImprimirRespuesta() {
    const { id_respuesta } = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();
    
    const { 
        user, t, language, setLanguage, theme, toggleTheme,
        fetchRespuestaDetalle, fetchCuestionarioDetalle 
    } = useCuestionariosContext();

    const [loading, setLoading] = useState(true);
    const [responseDoc, setResponseDoc] = useState(null);
    const [cuestionarioDoc, setCuestionarioDoc] = useState(null);
    
    // Toggle between printing completed answers or a blank template
    const [printBlank, setPrintBlank] = useState(searchParams.get('blank') === 'true');

    // Local Translations
    const localT = {
        es: {
            evalReport: 'Reporte de Evaluación Clínica',
            evalForm: 'Formulario de Evaluación de Cuestionario',
            patient: 'Nombre del Paciente / Usuario',
            evaluator: 'Evaluador / Profesional',
            status: 'Estado de Evaluación',
            startDate: 'Fecha de Inicio',
            endDate: 'Fecha de Fin',
            duration: 'Duración de Sesión',
            score: 'Puntaje Total',
            classification: 'Clasificación',
            signatureEvaluator: 'Firma del Evaluador / Profesional',
            signaturePatient: 'Firma del Paciente / Usuario',
            stamp: 'Sello Institucional',
            blankTemplate: 'Plantilla Vacía',
            completedVersion: 'Versión Diligenciada',
            printPdf: 'Imprimir / Guardar PDF',
            backDashboard: 'Volver al Dashboard',
            points: 'Puntos',
            unanswered: 'No respondido',
            matches: 'Correspondencias',
            notApplied: 'No aplica / Saltado',
            institutionName: 'Teker Apps - Salud Integrada'
        },
        en: {
            evalReport: 'Clinical Evaluation Report',
            evalForm: 'Questionnaire Evaluation Form',
            patient: 'Patient / User Name',
            evaluator: 'Evaluator / Professional',
            status: 'Evaluation Status',
            startDate: 'Start Date',
            endDate: 'End Date',
            duration: 'Session Duration',
            score: 'Total Score',
            classification: 'Classification',
            signatureEvaluator: 'Evaluator / Professional Signature',
            signaturePatient: 'Patient / User Signature',
            stamp: 'Institutional Stamp',
            blankTemplate: 'Blank Template',
            completedVersion: 'Completed Version',
            printPdf: 'Print / Save PDF',
            backDashboard: 'Back to Dashboard',
            points: 'Points',
            unanswered: 'Unanswered',
            matches: 'Matches',
            notApplied: 'Not applicable / Skipped',
            institutionName: 'Teker Apps - Integrated Health'
        }
    };

    const currentT = localT[language] || localT.es;

    useEffect(() => {
        const loadDocData = async () => {
            setLoading(true);
            try {
                // If it's a numeric response ID
                if (id_respuesta && !isNaN(id_respuesta)) {
                    const respData = await fetchRespuestaDetalle(id_respuesta);
                    if (respData) {
                        setResponseDoc(respData);
                        const questData = await fetchCuestionarioDetalle(respData.id_cuestionario);
                        if (questData) {
                            setCuestionarioDoc(questData);
                        }
                    } else {
                        // Try fetching as a questionnaire ID directly if response fails
                        const questData = await fetchCuestionarioDetalle(id_respuesta);
                        if (questData) {
                            setCuestionarioDoc(questData);
                            setPrintBlank(true);
                        }
                    }
                } else {
                    // Try fetching questionnaire directly
                    const questData = await fetchCuestionarioDetalle(id_respuesta);
                    if (questData) {
                        setCuestionarioDoc(questData);
                        setPrintBlank(true);
                    }
                }
            } catch (e) {
                console.error('Error loading print details:', e);
            } finally {
                setLoading(false);
            }
        };

        if (id_respuesta) {
            loadDocData();
        }
    }, [id_respuesta, fetchCuestionarioDetalle, fetchRespuestaDetalle]);

    const handlePrint = () => {
        window.print();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#effaff] dark:bg-[#121212]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#ff7a39]"></div>
            </div>
        );
    }

    if (!cuestionarioDoc && !responseDoc) {
        return (
            <div className="flex flex-col min-h-screen justify-center items-center p-4">
                <div className="glass-panel p-6 text-center space-y-4 max-w-sm border-[#b6ecff] dark:border-[#262626]">
                    <p className="text-sm font-semibold text-white">No se pudo cargar la información para imprimir.</p>
                    <button onClick={() => router.push('/')} className="px-4 py-2 bg-[#ff7a39] text-white text-xs font-bold rounded-lg">{t('back')}</button>
                </div>
            </div>
        );
    }

    // Determine questionnaire general info
    const questionnaireName = cuestionarioDoc ? cuestionarioDoc.nombre : (responseDoc ? responseDoc.cuestionario_nombre : '');
    const questionnaireDesc = cuestionarioDoc ? cuestionarioDoc.descripcion : '';
    const questionnaireVersion = cuestionarioDoc ? cuestionarioDoc.version : '';

    // Calculate duration
    let durationString = 'N/A';
    if (responseDoc && responseDoc.fecha_inicio && responseDoc.fecha_fin) {
        const start = new Date(responseDoc.fecha_inicio);
        const end = new Date(responseDoc.fecha_fin);
        const diffMs = Math.abs(end - start);
        const diffMins = Math.floor(diffMs / 60000);
        const diffSecs = Math.floor((diffMs % 60000) / 1000);
        durationString = `${diffMins}m ${diffSecs}s`;
    }

    // Check if response is complete
    const isCompleted = responseDoc && responseDoc.estado === 2;

    // Get list of questions to display
    // If completed: show ONLY questions that were answered (in their actual logical order of responses)
    // If blank: show ALL questions in their default section and visually ordered sequence.
    let displayQuestions = [];
    if (!printBlank && responseDoc && responseDoc.respuestas && responseDoc.respuestas.length > 0) {
        // Map answered list.
        displayQuestions = responseDoc.respuestas.map(ans => {
            // Find corresponding question structure to know its type and options
            let qStruct = null;
            let seccionId = null;
            let seccionNombre = null;
            if (cuestionarioDoc && cuestionarioDoc.secciones) {
                for (let sec of cuestionarioDoc.secciones) {
                    const match = (sec.preguntas || []).find(q => q.id === ans.id_pregunta);
                    if (match) {
                        qStruct = match;
                        seccionId = sec.id;
                        seccionNombre = sec.nombre;
                        break;
                    }
                }
            }
            return {
                id: ans.id_pregunta,
                codigo: ans.pregunta_codigo,
                texto_pregunta: ans.pregunta_texto,
                tipo_code: qStruct ? qStruct.tipo_codigo : 'ABIERTA',
                puntos_maximos: qStruct ? qStruct.puntos_maximos : 0,
                valor_obtenido: ans.valor_obtenido,
                respuesta_texto: ans.respuesta_texto,
                respuesta_numero: ans.respuesta_numero,
                respuesta_fecha: ans.respuesta_fecha,
                opciones_seleccionadas: ans.opciones_seleccionadas || [],
                original_question: qStruct,
                seccion_id: seccionId,
                seccion_nombre: seccionNombre
            };
        });
    } else if (cuestionarioDoc && cuestionarioDoc.secciones) {
        // Flatten all questions from all sections
        cuestionarioDoc.secciones.forEach(sec => {
            if (sec.preguntas) {
                sec.preguntas.forEach(q => {
                    displayQuestions.push({
                        id: q.id,
                        codigo: q.codigo,
                        texto_pregunta: q.texto_pregunta,
                        tipo_code: q.tipo_codigo,
                        puntos_maximos: q.puntos_maximos,
                        valor_obtenido: null,
                        respuesta_texto: null,
                        respuesta_numero: null,
                        respuesta_fecha: null,
                        opciones_seleccionadas: [],
                        original_question: q,
                        seccion_id: sec.id,
                        seccion_nombre: sec.nombre
                    });
                });
            }
        });
    }

    // Color classification mapping
    const badgeColorMap = {
        green: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800/30',
        orange: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800/30',
        red: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800/30',
        blue: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800/30',
        grey: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-900/30 dark:text-slate-400 dark:border-slate-800/30'
    };

    const statusBadgeMap = {
        1: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800/30',
        2: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800/30'
    };

    // Helper: render single question blank or filled template
    const renderQuestion = (q, idx) => {
        let associations = {};
        if (q.tipo_code === 'ASOCIATIVA' && q.respuesta_texto) {
            try {
                associations = JSON.parse(q.respuesta_texto);
            } catch (e) {
                console.error('Failed to parse associations JSON:', e);
            }
        }

        return (
            <div 
                key={q.id || idx} 
                className="border-b border-slate-200 pb-6 last:border-b-0 print:avoid-break"
            >
                <div className="flex justify-between items-start gap-4 mb-3">
                    <div className="flex gap-2">
                        <span className="text-xs font-black text-[#ff7a39] whitespace-nowrap bg-orange-50 px-2 py-0.5 rounded border border-orange-100">
                            {q.codigo || `P${idx + 1}`}
                        </span>
                        <h3 className="text-sm font-extrabold text-slate-800 leading-snug">
                            {q.texto_pregunta}
                        </h3>
                    </div>

                    {/* Points Label */}
                    <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap">
                        {!printBlank && q.valor_obtenido !== null ? (
                            <span className="text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-black">
                                {q.valor_obtenido} / {q.puntos_maximos || 0} pts
                            </span>
                        ) : (
                            <span>Max: {q.puntos_maximos || 0} pts</span>
                        )}
                    </span>
                </div>

                {/* Answers Rendering depending on Question Type */}
                <div className="pl-8 text-xs">
                    
                    {/* ABIERTA Type */}
                    {q.tipo_code === 'ABIERTA' && (
                        <div>
                            {!printBlank ? (
                                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-semibold italic min-h-[40px]">
                                    {q.respuesta_texto || q.respuesta_numero || q.respuesta_fecha || `(${currentT.unanswered})`}
                                </div>
                            ) : (
                                <div className="border border-slate-300 rounded-lg h-20 w-full mt-2 relative">
                                    <div className="absolute inset-x-0 bottom-3 border-b border-dashed border-slate-300 mx-3"></div>
                                    <div className="absolute inset-x-0 bottom-10 border-b border-dashed border-slate-300 mx-3"></div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* UNICA Selection (Radio Circles) */}
                    {q.tipo_code === 'UNICA' && (
                        <div className="space-y-2 mt-1">
                            {q.original_question?.opciones?.map(op => {
                                const isSelected = !printBlank && q.opciones_seleccionadas.some(sel => sel.id_opcion === op.id);
                                return (
                                    <div 
                                        key={op.id} 
                                        className={`flex items-center gap-2 p-1.5 rounded transition-all ${isSelected ? 'bg-slate-100 font-bold border border-slate-200' : 'text-slate-600'}`}
                                    >
                                        <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${isSelected ? 'border-[#00aae1] bg-white' : 'border-slate-400'}`}>
                                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-[#00aae1]"></div>}
                                        </div>
                                        <span>{op.texto_opcion}</span>
                                        {(!printBlank && isSelected) && (
                                            <span className="text-[9px] text-[#00aae1] font-extrabold uppercase ml-auto">
                                                (+{op.valor_opcion || 0} pts)
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* MULTIPLE Selection (Checkboxes) */}
                    {q.tipo_code === 'MULTIPLE' && (
                        <div className="space-y-2 mt-1">
                            {q.original_question?.opciones?.map(op => {
                                const isSelected = !printBlank && q.opciones_seleccionadas.some(sel => sel.id_opcion === op.id);
                                return (
                                    <div 
                                        key={op.id} 
                                        className={`flex items-center gap-2 p-1.5 rounded transition-all ${isSelected ? 'bg-slate-100 font-bold border border-slate-200' : 'text-slate-600'}`}
                                    >
                                        <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${isSelected ? 'border-[#01ae6c] bg-[#01ae6c]' : 'border-slate-400'}`}>
                                            {isSelected && <span className="text-white text-[9px] font-black">✓</span>}
                                        </div>
                                        <span>{op.texto_opcion}</span>
                                        {(!printBlank && isSelected) && (
                                            <span className="text-[9px] text-[#01ae6c] font-extrabold uppercase ml-auto">
                                                (+{op.valor_opcion || 0} pts)
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* ASOCIATIVA Columns (Matching Pair Cards) */}
                    {q.tipo_code === 'ASOCIATIVA' && (
                        <div className="mt-2">
                            {!printBlank ? (
                                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2">
                                    <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">{currentT.matches}</h5>
                                    {q.original_question?.asociaciones?.map(assoc => {
                                        const matchedDer = associations[assoc.item_izquierdo] || '';
                                        const isCorrect = matchedDer === assoc.item_derecho;
                                        
                                        return (
                                            <div key={assoc.id} className="flex justify-between items-center border-b border-slate-200/60 pb-1.5 last:border-0 last:pb-0 font-semibold">
                                                <span className="text-slate-800">{assoc.item_izquierdo}</span>
                                                <span className="text-slate-400 px-3">◀ ─── ▶</span>
                                                <span className={matchedDer ? (isCorrect ? 'text-green-600 font-bold' : 'text-red-500 line-through') : 'text-slate-400'}>
                                                    {matchedDer || `(${currentT.unanswered})`}
                                                </span>
                                                {matchedDer && (
                                                    <span className={`text-[9px] uppercase font-extrabold ml-3 ${isCorrect ? 'text-green-600' : 'text-red-500'}`}>
                                                        {isCorrect ? `+${assoc.valor_correcto || 0} pts` : '0 pts'}
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-4 mt-2">
                                    <div>
                                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block mb-1">Columna A</span>
                                        <div className="space-y-3">
                                            {q.original_question?.asociaciones?.map((assoc, idx) => (
                                                <div key={assoc.id} className="p-2 border border-slate-300 rounded font-semibold text-slate-700 bg-slate-50">
                                                    {idx + 1}. {assoc.item_izquierdo}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block mb-1">Columna B (Respuestas)</span>
                                        <div className="space-y-3">
                                            {q.original_question?.asociaciones?.map((assoc, idx) => (
                                                <div key={assoc.id} className="p-2 border border-slate-300 rounded font-semibold text-slate-700 flex justify-between items-center bg-slate-50">
                                                    <span>[ &nbsp; ] &nbsp; {assoc.item_derecho}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-slate-900 text-slate-800 flex flex-col items-center pb-12 transition-all">
            
            {/* Header Controls (Sticky, Hidden on Print) */}
            <div className="no-print sticky top-0 w-full z-30 bg-slate-950/80 backdrop-blur-md border-b border-slate-800 py-3.5 px-6 flex justify-between items-center shadow-md">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => router.push(user ? '/admin/dashboard' : '/')}
                        className="px-3 py-1.5 rounded-lg border border-slate-700 hover:border-[#ff7a39] text-xs font-bold text-slate-300 transition-all"
                    >
                        ◀ {currentT.backDashboard}
                    </button>
                    <div>
                        <h4 className="text-xs font-extrabold text-white uppercase tracking-wider">{currentT.printPdf}</h4>
                        <span className="text-[10px] text-slate-400 block max-w-xs truncate">{questionnaireName}</span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Toggle Template Type if response exists */}
                    {responseDoc && (
                        <div className="flex rounded-lg bg-slate-800 p-0.5 border border-slate-700">
                            <button
                                onClick={() => setPrintBlank(false)}
                                className={`px-3 py-1 text-[10px] font-bold uppercase rounded-md transition-all ${!printBlank ? 'bg-[#ff7a39] text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                            >
                                {currentT.completedVersion}
                            </button>
                            <button
                                onClick={() => setPrintBlank(true)}
                                className={`px-3 py-1 text-[10px] font-bold uppercase rounded-md transition-all ${printBlank ? 'bg-[#ff7a39] text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                            >
                                {currentT.blankTemplate}
                            </button>
                        </div>
                    )}

                    <button
                        onClick={() => setLanguage(language === 'es' ? 'en' : 'es')}
                        className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs font-semibold uppercase text-slate-300 hover:border-[#ff7a39]"
                    >
                        {language === 'es' ? 'EN' : 'ES'}
                    </button>

                    <button
                        onClick={toggleTheme}
                        className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs font-semibold text-slate-300 hover:border-[#ff7a39]"
                    >
                        {theme === 'light' ? '🌙' : '☀️'}
                    </button>

                    <button
                        onClick={handlePrint}
                        className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-[#ff7a39] to-[#ff5a1f] hover:from-[#e06020] hover:to-[#e04a14] text-white font-extrabold text-xs uppercase tracking-wider shadow-md transition-all active:scale-[0.98] flex items-center gap-1.5"
                    >
                        🖨️ {currentT.printPdf}
                    </button>
                </div>
            </div>

            {/* Print Layout Document Container */}
            {/* On screen, simulates a sheet of paper. On print, scales to full page width. */}
            <div className="w-full max-w-4xl mx-auto mt-6 bg-white p-8 md:p-12 shadow-2xl rounded-xl border border-slate-200 print:shadow-none print:border-none print:m-0 print:p-0 print:rounded-none">
                
                {/* Institutional Header */}
                <div className="flex justify-between items-start border-b-2 border-slate-300 pb-5 mb-6">
                    <div className="flex gap-4 items-center">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#ff7a39] to-[#ff5a1f] flex items-center justify-center shadow-sm">
                            <span className="text-white font-bold text-xl">T</span>
                        </div>
                        <div>
                            <h2 className="text-md font-extrabold uppercase tracking-wide text-slate-800">
                                {currentT.institutionName}
                            </h2>
                            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                                {printBlank ? currentT.evalForm : currentT.evalReport}
                            </p>
                        </div>
                    </div>

                    <div className="text-right">
                        <span className="text-xs font-bold text-slate-500 uppercase block">{currentT.startDate}</span>
                        <span className="text-xs font-extrabold text-slate-800">
                            {(!printBlank && responseDoc) 
                                ? new Date(responseDoc.fecha_inicio).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) 
                                : new Date().toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                    </div>
                </div>

                {/* Document Subtitle & Description */}
                <div className="mb-6 space-y-2">
                    <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight leading-tight">
                        {questionnaireName}
                    </h1>
                    {questionnaireDesc && (
                        <p className="text-xs text-slate-500 font-medium italic leading-relaxed">
                            {questionnaireDesc}
                        </p>
                    )}
                </div>

                {/* Metadata Information Grid */}
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 mb-8 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-medium">
                    <div className="space-y-2">
                        <div className="flex justify-between border-b border-slate-200 pb-1.5">
                            <span className="text-slate-500 uppercase font-bold tracking-wider">{currentT.patient}:</span>
                            <span className="text-slate-800 font-extrabold">
                                {(!printBlank && responseDoc && responseDoc.id_usuario) ? `ID: ${responseDoc.id_usuario}` : '____________________________________'}
                            </span>
                        </div>
                        
                        <div className="flex justify-between border-b border-slate-200 pb-1.5">
                            <span className="text-slate-500 uppercase font-bold tracking-wider">{currentT.evaluator}:</span>
                            <span className="text-slate-800 font-extrabold">
                                {user ? user.usuario : '____________________________________'}
                            </span>
                        </div>

                        {(!printBlank && responseDoc) && (
                            <div className="flex justify-between border-b border-slate-200 pb-1.5">
                                <span className="text-slate-500 uppercase font-bold tracking-wider">{currentT.duration}:</span>
                                <span className="text-slate-800 font-extrabold">{durationString}</span>
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between border-b border-slate-200 pb-1.5">
                            <span className="text-slate-500 uppercase font-bold tracking-wider">{currentT.status}:</span>
                            {(!printBlank && responseDoc) ? (
                                <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${statusBadgeMap[responseDoc.estado] || badgeColorMap.grey}`}>
                                    {responseDoc.estado === 2 ? t('completed') : t('draft')}
                                </span>
                            ) : (
                                <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${badgeColorMap.grey}`}>
                                    {currentT.blankTemplate}
                                </span>
                            )}
                        </div>

                        {(!printBlank && responseDoc && isCompleted && parseInt(responseDoc.id_tipo_cuestionario) !== 2) && (
                            <>
                                <div className="flex justify-between border-b border-slate-200 pb-1.5">
                                    <span className="text-slate-500 uppercase font-bold tracking-wider">{currentT.score}:</span>
                                    <span className="text-slate-800 font-black text-sm">
                                        {responseDoc.puntaje_total}
                                    </span>
                                </div>
                                <div className="flex justify-between border-b border-slate-200 pb-1.5 items-center">
                                    <span className="text-slate-500 uppercase font-bold tracking-wider">{currentT.classification}:</span>
                                    <span className="text-slate-800 font-black">
                                        {responseDoc.clasificacion_final || 'Sin clasificar'}
                                    </span>
                                </div>
                            </>
                        )}
                        
                        <div className="flex justify-between border-b border-slate-200 pb-1.5">
                            <span className="text-slate-500 uppercase font-bold tracking-wider">{t('version')}:</span>
                            <span className="text-slate-800 font-extrabold">v{questionnaireVersion || '1.0'}</span>
                        </div>
                    </div>
                </div>

                {/* Clinical Results Section */}
                {!printBlank && responseDoc && parseInt(responseDoc.id_tipo_cuestionario) === 2 && (
                    <div className="mb-8 border border-slate-200 rounded-xl overflow-hidden print:avoid-break">
                        <div className="bg-slate-100 px-4 py-3 border-b border-slate-200">
                            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                                {language === 'es' ? 'Resultados de Evaluación Clínica' : 'Clinical Evaluation Results'}
                            </h3>
                        </div>
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="p-3 font-extrabold text-slate-700 uppercase tracking-wider">{language === 'es' ? 'Código' : 'Code'}</th>
                                    <th className="p-3 font-extrabold text-slate-700 uppercase tracking-wider">{language === 'es' ? 'Variable' : 'Variable'}</th>
                                    <th className="p-3 font-extrabold text-slate-700 uppercase tracking-wider text-center">{language === 'es' ? 'Puntaje' : 'Score'}</th>
                                    <th className="p-3 font-extrabold text-slate-700 uppercase tracking-wider">{language === 'es' ? 'Clasificación' : 'Classification'}</th>
                                    <th className="p-3 font-extrabold text-slate-700 uppercase tracking-wider">{language === 'es' ? 'Descripción' : 'Description'}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {(responseDoc.resultados_clinicos || []).map((varCli, index) => {
                                    const colorMapText = {
                                        green: '#16a34a',
                                        orange: '#ea580c',
                                        red: '#dc2626',
                                        blue: '#2563eb',
                                        grey: '#64748b'
                                    };
                                    const textCol = colorMapText[varCli.color_visual] || '#64748b';
                                    return (
                                        <tr key={index} className="hover:bg-slate-50">
                                            <td className="p-3 font-bold text-slate-500">{varCli.codigo}</td>
                                            <td className="p-3 font-bold text-slate-800">{varCli.nombre}</td>
                                            <td className="p-3 font-black text-center text-slate-800">{varCli.score}</td>
                                            <td className="p-3">
                                                <span className="font-extrabold px-2 py-0.5 rounded text-[10px] text-white uppercase tracking-wider" style={{ backgroundColor: textCol }}>
                                                    {varCli.clasificacion}
                                                </span>
                                            </td>
                                            <td className="p-3 text-slate-600 italic leading-snug">{varCli.descripcion}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Questions Checklist */}
                <div className="space-y-8">
                    {cuestionarioDoc && cuestionarioDoc.secciones && cuestionarioDoc.secciones.length > 1 ? (
                        cuestionarioDoc.secciones.map((sec, secIdx) => {
                            const secQuestions = displayQuestions.filter(q => q.seccion_id === sec.id);
                            if (secQuestions.length === 0) return null;
                            return (
                                <div key={sec.id || secIdx} className="space-y-4 mb-8 print:avoid-break">
                                    <div className="bg-slate-50 p-2.5 rounded-lg border-l-4 border-[#ff7a39]">
                                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">{sec.nombre}</h3>
                                        {sec.descripcion && <p className="text-[10px] text-slate-500 italic mt-0.5">{sec.descripcion}</p>}
                                    </div>
                                    <div className="space-y-6 pl-2">
                                        {secQuestions.map((q, idx) => renderQuestion(q, idx))}
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="space-y-8">
                            {displayQuestions.map((q, idx) => renderQuestion(q, idx))}
                        </div>
                    )}
                </div>

                {/* Signature Blocks & stamp space */}
                <div className="mt-16 pt-8 border-t-2 border-slate-300 grid grid-cols-2 gap-12 print:avoid-break">
                    <div className="text-center space-y-4">
                        <div className="h-16"></div>
                        <div className="border-t border-slate-400 pt-2 text-xs font-bold text-slate-700 uppercase tracking-wide">
                            {currentT.signatureEvaluator}
                        </div>
                        <div className="text-[10px] font-medium text-slate-400">
                            C.C. ________________________
                        </div>
                    </div>

                    <div className="text-center space-y-4">
                        <div className="h-16"></div>
                        <div className="border-t border-slate-400 pt-2 text-xs font-bold text-slate-700 uppercase tracking-wide">
                            {currentT.signaturePatient}
                        </div>
                        <div className="text-[10px] font-medium text-slate-400">
                            C.C. ________________________
                        </div>
                    </div>
                </div>

                {/* Institution Stamp block */}
                <div className="mt-12 flex justify-end print:avoid-break">
                    <div className="w-36 h-36 border-2 border-dashed border-slate-300 rounded-xl flex flex-col justify-center items-center text-center p-3 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                        <span>{currentT.stamp}</span>
                        <div className="w-12 h-12 border border-dashed border-slate-300 rounded-full mt-3"></div>
                    </div>
                </div>

            </div>

            {/* Print Media Specific CSS for Custom Paper formatting */}
            <style jsx global>{`
                @media print {
                    /* Reset body to print standard letter sizes */
                    body {
                        background: #ffffff !important;
                        color: #000000 !important;
                    }
                    nav, header, footer, .no-print, .no-print * {
                        display: none !important;
                    }
                    /* Main container expansion */
                    .print\\:shadow-none {
                        box-shadow: none !important;
                    }
                    .print\\:border-none {
                        border: none !important;
                    }
                    .print\\:m-0 {
                        margin: 0 !important;
                    }
                    .print\\:p-0 {
                        padding: 0 !important;
                    }
                    .print\\:rounded-none {
                        border-radius: 0 !important;
                    }
                    .print\\:avoid-break {
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                    /* Ensure text visibility is black high contrast */
                    .text-slate-800 {
                        color: #1e293b !important;
                    }
                    .text-slate-700 {
                        color: #334155 !important;
                    }
                    .text-slate-500 {
                        color: #64748b !important;
                    }
                    .text-slate-400 {
                        color: #94a3b8 !important;
                    }
                    .bg-slate-50 {
                        background-color: #f8fafc !important;
                    }
                    .bg-slate-100 {
                        background-color: #f1f5f9 !important;
                    }
                }
            `}</style>

        </div>
    );
}
