'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useCuestionariosContext } from '@/context/CuestionariosContext';

export default function Responder() {
    const { id } = useParams();
    const router = useRouter();
    const { 
        alert, user, t, language, theme, toggleTheme,
        fetchCuestionarioDetalle, currentCuestionario, iniciarRespuesta, guardarRespuestas, finalizarCuestionario 
    } = useCuestionariosContext();

    const [cuestionario, setCuestionario] = useState(null);
    const [loading, setLoading] = useState(true);
    
    // Answering session states
    const [responseId, setResponseId] = useState(null);
    const [allQuestions, setAllQuestions] = useState([]);
    const [currentIdx, setCurrentIdx] = useState(0);
    const [history, setHistory] = useState([]); // Questions history to backtrace dynamic flows
    
    // User Answers State: { [questionId]: { text, number, date, options: [opId], associations: { [izq]: der } } }
    const [answers, setAnswers] = useState({});
    
    // Result Screen State
    const [finished, setFinished] = useState(false);
    const [resultData, setResultData] = useState(null);
    const [savingAnswers, setSavingAnswers] = useState(false);
    // Print modal state
    const [showPrintModal, setShowPrintModal] = useState(false);

    useEffect(() => {
        const initSession = async () => {
            setLoading(true);
            const data = await fetchCuestionarioDetalle(id);
            if (data) {
                setCuestionario(data);
                
                // Flatten all questions in order
                const flatList = [];
                (data.secciones || []).forEach(sec => {
                    if (sec.preguntas) {
                        sec.preguntas.forEach(q => flatList.push({
                            ...q,
                            seccion_id: sec.id,
                            seccion_nombre: sec.nombre
                        }));
                    }
                });
                setAllQuestions(flatList);

                // Create database response instance
                const resp = await iniciarRespuesta(data.id, user ? user.usuario : null);
                if (resp.success) {
                    setResponseId(resp.id_cuestionario_respuesta);
                } else {
                    console.error('Failed to create response session:', resp.error);
                }
            } else {
                router.push('/');
            }
            setLoading(false);
        };
        initSession();
    }, [id, user, router, fetchCuestionarioDetalle, iniciarRespuesta]);

    const activeQuestion = allQuestions[currentIdx];

    // Format current answers state to format expected by API / DB
    const formatAnswersForApi = () => {
        return Object.keys(answers).map(qId => {
            const q = allQuestions.find(curr => curr.id === parseInt(qId));
            const ansObj = answers[qId];
            
            let valObt = 0;
            const selectedOptions = [];

            if (q.tipo_codigo === 'UNICA') {
                const selOpId = ansObj.options[0];
                if (selOpId) {
                    const op = q.opciones.find(curr => curr.id === parseInt(selOpId));
                    if (op) {
                        valObt = op.valor_opcion || 0;
                        selectedOptions.push({ id_opcion: op.id, valor_obtenido: op.valor_opcion });
                    }
                }
            } else if (q.tipo_codigo === 'MULTIPLE') {
                ansObj.options.forEach(opId => {
                    const op = q.opciones.find(curr => curr.id === parseInt(opId));
                    if (op) {
                        valObt += op.valor_opcion || 0;
                        selectedOptions.push({ id_opcion: op.id, valor_obtenido: op.valor_opcion });
                    }
                });
            } else if (q.tipo_codigo === 'ASOCIATIVA') {
                // Grade associations
                if (ansObj.associations) {
                    Object.keys(ansObj.associations).forEach(izq => {
                        const matchedDer = ansObj.associations[izq];
                        const assoc = q.asociaciones.find(curr => curr.item_izquierdo === izq);
                        if (assoc && assoc.item_derecho === matchedDer) {
                            valObt += assoc.valor_correcto || 0;
                        }
                    });
                }
            }

            return {
                id_pregunta: q.id,
                respuesta_texto: q.tipo_codigo === 'ABIERTA' ? ansObj.text : (q.tipo_codigo === 'ASOCIATIVA' ? JSON.stringify(ansObj.associations || {}) : null),
                respuesta_numero: q.tipo_codigo === 'ABIERTA' ? parseFloat(ansObj.text) || null : null,
                respuesta_fecha: null,
                valor_obtenido: valObt,
                opciones_seleccionadas: selectedOptions
            };
        });
    };

    // Save Draft
    const handleSaveDraft = async () => {
        if (!responseId) return;
        setSavingAnswers(true);
        const formatted = formatAnswersForApi();
        const res = await guardarRespuestas(responseId, formatted);
        setSavingAnswers(false);
        if (res.success) {
            await alert(language === 'es' ? '¡Borrador guardado exitosamente!' : 'Draft saved successfully!');
            router.push('/');
        } else {
            await alert(language === 'es' ? 'Error al guardar' : 'Error saving draft');
        }
    };

    // Navigation and logical jump evaluation
    const handleNext = async () => {
        // Validation check for active question if required
        if (activeQuestion.obligatoria === 1) {
            const ans = answers[activeQuestion.id];
            if (!ans || 
                (activeQuestion.tipo_codigo === 'ABIERTA' && !ans.text.trim()) ||
                ((activeQuestion.tipo_codigo === 'UNICA' || activeQuestion.tipo_codigo === 'MULTIPLE') && ans.options.length === 0) ||
                (activeQuestion.tipo_codigo === 'ASOCIATIVA' && Object.keys(ans.associations || {}).length < activeQuestion.asociaciones.length)
            ) {
                await alert(language === 'es' ? 'Esta pregunta es obligatoria' : 'This question is required');
                return;
            }
        }

        // Save current question index to history path
        setHistory(prev => [...prev, currentIdx]);

        // Evaluate dynamic flows
        const activeAns = answers[activeQuestion.id] || { options: [], text: '' };
        let targetCode = null;

        // Sort flujos by priority
        const relatedFlows = (cuestionario.flujos || [])
            .filter(f => f.codigo_pregunta_origen === activeQuestion.codigo)
            .sort((a, b) => a.prioridad - b.prioridad);

        for (let flow of relatedFlows) {
            let matches = false;

            if (activeQuestion.tipo_codigo === 'UNICA' || activeQuestion.tipo_codigo === 'MULTIPLE') {
                if (flow.codigo_opcion_respuesta) {
                    // Check if matching option is selected
                    const op = activeQuestion.opciones.find(curr => curr.codigo_opcion === flow.codigo_opcion_respuesta);
                    if (op && activeAns.options.includes(op.id.toString())) {
                        matches = true;
                    }
                }
            } else if (activeQuestion.tipo_codigo === 'ABIERTA') {
                // Check operators like =, >, <
                const textVal = activeAns.text;
                if (flow.operador_codigo === '=') {
                    matches = textVal === flow.valor_comparacion;
                } else if (flow.operador_codigo === '>') {
                    matches = parseFloat(textVal) > parseFloat(flow.valor_comparacion);
                } else if (flow.operador_codigo === '<') {
                    matches = parseFloat(textVal) < parseFloat(flow.valor_comparacion);
                } else if (flow.operador_codigo === 'LIKE') {
                    matches = textVal.toLowerCase().includes(flow.valor_comparacion.toLowerCase());
                }
            }

            if (matches) {
                targetCode = flow.codigo_pregunta_destino;
                break; // Found matching priority flow, stop checking
            }
        }

        if (targetCode) {
            // Find index of destination question
            const targetIdx = allQuestions.findIndex(q => q.codigo === targetCode);
            if (targetIdx !== -1) {
                setCurrentIdx(targetIdx);
                return;
            }
        }

        // Fallback: Go to next sequential question
        if (currentIdx < allQuestions.length - 1) {
            setCurrentIdx(currentIdx + 1);
        } else {
            // Finalize
            handleFinalize();
        }
    };

    const handleBack = () => {
        if (history.length > 0) {
            const prevIdx = history[history.length - 1];
            setHistory(prev => prev.slice(0, -1));
            setCurrentIdx(prevIdx);
        }
    };

    // Finalize Questionnaire answering
    const handleFinalize = async () => {
        if (!responseId) return;

        // If it is single page layout, validate ALL mandatory questions first
        if (cuestionario.presentacion_unica === 1) {
            for (let q of allQuestions) {
                if (q.obligatoria === 1) {
                    const ans = answers[q.id];
                    if (!ans || 
                        (q.tipo_codigo === 'ABIERTA' && (!ans.text || !ans.text.trim())) ||
                        ((q.tipo_codigo === 'UNICA' || q.tipo_codigo === 'MULTIPLE') && (!ans.options || ans.options.length === 0)) ||
                        (q.tipo_codigo === 'ASOCIATIVA' && (!ans.associations || Object.keys(ans.associations).length < q.asociaciones.length))
                    ) {
                        await alert(language === 'es' 
                            ? `La pregunta "${q.texto_pregunta}" es obligatoria.` 
                            : `The question "${q.texto_pregunta}" is required.`
                        );
                        const el = document.getElementById(`pregunta-container-${q.id}`);
                        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        return;
                    }
                }
            }
        }

        setSavingAnswers(true);
        try {
            // Save final answers first
            const formatted = formatAnswersForApi();
            await guardarRespuestas(responseId, formatted);
            
            // Call finalizer procedure
            const res = await finalizarCuestionario(responseId);
            if (res.success) {
                setResultData(res);
                setFinished(true);
            } else {
                await alert(language === 'es' ? 'Error al finalizar: ' + res.error : 'Finalization failed: ' + res.error);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setSavingAnswers(false);
        }
    };

    // Export Results to JSON File
    const handleExportJSON = () => {
        if (!cuestionario) return;
        const formatted = formatAnswersForApi();
        const exportObj = {
            cuestionario: {
                id: cuestionario.id,
                nombre: cuestionario.nombre,
                descripcion: cuestionario.descripcion,
                version: cuestionario.version
            },
            resultado: {
                id_respuesta: responseId,
                usuario: user ? user.usuario : null,
                fecha: new Date().toISOString(),
                puntaje_total: resultData?.puntaje_total ?? null,
                clasificacion_final: resultData?.clasificacion_final ?? null,
                color: resultData?.color ?? null,
                resultados_clinicos: resultData?.resultados_clinicos ?? null
            },
            respuestas: formatted.map(ans => {
                const q = allQuestions.find(curr => curr.id === ans.id_pregunta);
                return {
                    id_pregunta: ans.id_pregunta,
                    codigo_pregunta: q?.codigo || null,
                    pregunta: q?.texto_pregunta || null,
                    tipo: q?.tipo_codigo || null,
                    seccion: q?.seccion_nombre || null,
                    respuesta_texto: ans.respuesta_texto,
                    respuesta_numero: ans.respuesta_numero,
                    valor_obtenido: ans.valor_obtenido,
                    opciones_seleccionadas: (ans.opciones_seleccionadas || []).map(opSel => {
                        const originalOp = q?.opciones?.find(o => o.id === opSel.id_opcion);
                        return {
                            id_opcion: opSel.id_opcion,
                            texto_opcion: originalOp?.texto_opcion || null,
                            valor_opcion: opSel.valor_obtenido
                        };
                    })
                };
            })
        };

        const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `resultado_${cuestionario.nombre.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${responseId}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    // Value setters for input updates
    const setOpenTextVal = (questionId, val) => {
        setAnswers(prev => ({
            ...prev,
            [questionId]: {
                ...(prev[questionId] || { options: [], text: '', associations: {} }),
                text: val,
                options: []
            }
        }));
    };

    const toggleOptionVal = (questionId, opId, isRadio = false) => {
        setAnswers(prev => {
            const currentObj = prev[questionId] || { options: [], text: '', associations: {} };
            let newOps = [];
            if (isRadio) {
                newOps = [opId.toString()];
            } else {
                newOps = currentObj.options.includes(opId.toString())
                    ? currentObj.options.filter(id => id !== opId.toString())
                    : [...currentObj.options, opId.toString()];
            }
            return {
                ...prev,
                [questionId]: {
                    ...currentObj,
                    options: newOps
                }
            };
        });
    };

    const setAssociationVal = (questionId, izq, der) => {
        setAnswers(prev => {
            const currentObj = prev[questionId] || { associations: {}, options: [], text: '' };
            const nextAssoc = { ...(currentObj.associations || {}), [izq]: der };
            return {
                ...prev,
                [questionId]: {
                    ...currentObj,
                    associations: nextAssoc
                }
            };
        });
    };

    if (loading || !cuestionario) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#effaff] dark:bg-[#121212]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#ff7a39]"></div>
            </div>
        );
    }

    if (finished && resultData) {
        // Result classification color matching
        const colorMap = {
            green: 'bg-green-500/10 text-green-500 border border-green-500/20 shadow-green-500/10',
            orange: 'bg-orange-500/10 text-orange-500 border border-orange-500/20 shadow-orange-500/10',
            red: 'bg-red-500/10 text-red-500 border border-red-500/20 shadow-red-500/10',
            blue: 'bg-blue-500/10 text-blue-500 border border-blue-500/20 shadow-blue-500/10',
            grey: 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
        };

        const isClinical = parseInt(cuestionario.id_tipo_cuestionario) === 2;
        // Determine if this questionnaire has meaningful scoring:
        // Only show score/classification when result ranges were actually configured
        const hasScore = Array.isArray(cuestionario.resultados) && cuestionario.resultados.length > 0;

        return (
            <div className="flex flex-col min-h-screen relative overflow-hidden justify-center items-center p-4">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-500/10 blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-orange-500/10 blur-[120px]" />

                <div className={`w-full ${isClinical ? 'max-w-3xl' : 'max-w-md'} glass-panel p-8 text-center space-y-6 shadow-2xl animate-fade-in relative z-10 border-[#b6ecff] dark:border-[#262626]`}>
                    
                    <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto text-green-500 text-3xl shadow-lg border border-green-500/20 animate-bounce">
                        ✓
                    </div>

                    <div>
                        <h2 className="text-xl font-black text-white dark:text-[#fafafa]">
                            {t('successText')}
                        </h2>
                        <p className="text-xs text-slate-400 font-semibold mt-1">
                            {cuestionario.nombre}
                        </p>
                    </div>

                    {/* Conditional rendering for clinical results */}
                    {isClinical ? (
                        <div className="space-y-6 text-left">
                            <h3 className="text-xs font-black uppercase tracking-widest text-[#ff7a39] mb-3 text-center">
                                {language === 'es' ? 'Resultados de Evaluación Clínica' : 'Clinical Evaluation Results'}
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {(resultData.resultados_clinicos || []).map((varCli, index) => {
                                    const cardBgColorClass = colorMap[varCli.color_visual] || colorMap.grey;
                                    return (
                                        <div key={index} className={`p-4 rounded-xl border ${cardBgColorClass} shadow-md flex flex-col justify-between space-y-3`}>
                                            <div>
                                                <span className="text-[9px] font-black uppercase tracking-widest opacity-60 block">{varCli.codigo}</span>
                                                <h4 className="text-sm font-bold text-white leading-tight">{varCli.nombre}</h4>
                                            </div>
                                            <div className="flex items-baseline justify-between mt-2">
                                                <span className="text-2xl font-black">{varCli.score} <span className="text-xs font-semibold opacity-70">pts</span></span>
                                                <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-white/20 uppercase tracking-wider">{varCli.clasificacion}</span>
                                            </div>
                                            {varCli.descripcion && (
                                                <p className="text-[11px] opacity-80 mt-1 italic leading-snug border-t border-white/10 pt-2">
                                                    {varCli.descripcion}
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Summary Table */}
                            <div className="space-y-2 mt-4">
                                <span className="text-[10px] font-black uppercase tracking-widest text-[#00aae1] block">
                                    {language === 'es' ? 'Resumen de Variables' : 'Variables Summary'}
                                </span>
                                <div className="overflow-x-auto border border-[#b6ecff]/20 dark:border-[#262626] rounded-xl bg-black/10">
                                    <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                            <tr className="bg-white/5 border-b border-[#b6ecff]/10 dark:border-[#262626]">
                                                <th className="p-3 font-extrabold text-[#00aae1] uppercase tracking-wider">{language === 'es' ? 'Variable' : 'Variable'}</th>
                                                <th className="p-3 font-extrabold text-[#00aae1] uppercase tracking-wider text-center">{language === 'es' ? 'Puntaje' : 'Score'}</th>
                                                <th className="p-3 font-extrabold text-[#00aae1] uppercase tracking-wider">{language === 'es' ? 'Interpretación' : 'Interpretation'}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {(resultData.resultados_clinicos || []).map((varCli, index) => {
                                                const textCol = {
                                                    green: 'text-green-400',
                                                    orange: 'text-orange-400',
                                                    red: 'text-red-400',
                                                    blue: 'text-blue-400',
                                                    grey: 'text-slate-400'
                                                }[varCli.color_visual] || 'text-slate-400';
                                                return (
                                                    <tr key={index} className="hover:bg-white/5 transition-all">
                                                        <td className="p-3 font-bold text-white">
                                                            <span className="text-[10px] font-black text-slate-400 block mr-2">{varCli.codigo}</span>
                                                            {varCli.nombre}
                                                        </td>
                                                        <td className="p-3 font-black text-center text-sm text-white">{varCli.score}</td>
                                                        <td className="p-3">
                                                            <span className={`font-black ${textCol}`}>
                                                                {varCli.clasificacion}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Only show score/classification when questionnaire has scoring */
                        hasScore && (
                            <div className={`p-6 rounded-2xl ${colorMap[resultData.color] || colorMap.grey} shadow-lg transition-all`}>
                                {(resultData.puntaje_total !== null && resultData.puntaje_total !== undefined) && (
                                    <>
                                        <span className="text-[10px] font-extrabold uppercase tracking-widest block opacity-70 mb-1">{t('score')}</span>
                                        <h3 className="text-4xl font-black mb-4">
                                            {resultData.puntaje_total}
                                        </h3>
                                    </>
                                )}
                                {resultData.clasificacion_final && resultData.clasificacion_final.trim() !== '' && (
                                    <>
                                        <span className="text-[10px] font-extrabold uppercase tracking-widest block opacity-70 mb-1">{t('classification')}</span>
                                        <p className="text-lg font-extrabold tracking-tight">
                                            {resultData.clasificacion_final}
                                        </p>
                                    </>
                                )}
                            </div>
                        )
                    )}

                    <div className="flex flex-col gap-2 pt-4">
                        <button
                            onClick={() => setShowPrintModal(true)}
                            className="w-full py-3 px-4 rounded-xl border border-[#b6ecff] dark:border-[#262626] hover:border-[#ff7a39] text-xs font-bold uppercase tracking-wider text-slate-700 hover:text-white transition-all"
                        >
                            🖨️ {t('print')} / PDF
                        </button>
                        <button
                            onClick={handleExportJSON}
                            className="w-full py-3 px-4 rounded-xl border border-[#b6ecff] dark:border-[#262626] hover:border-[#00aae1] text-xs font-bold uppercase tracking-wider text-slate-700 hover:text-white transition-all"
                        >
                            💾 {language === 'es' ? 'Exportar JSON' : 'Export JSON'}
                        </button>
                        <button
                            onClick={() => router.push('/')}
                            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-[#ff7a39] to-[#ff5a1f] hover:from-[#e06020] hover:to-[#e04a14] text-white font-bold text-xs uppercase tracking-wider shadow-md transition-all active:scale-[0.98]"
                        >
                            {language === 'es' ? 'Volver al Inicio' : 'Back to Home'}
                        </button>
                    </div>
                </div>

                {/* Print Modal */}
                {showPrintModal && (
                    <PrintResultModal
                        cuestionario={cuestionario}
                        responseId={responseId}
                        resultData={resultData}
                        hasScore={hasScore}
                        answers={answers}
                        allQuestions={allQuestions}
                        language={language}
                        onClose={() => setShowPrintModal(false)}
                    />
                )}
            </div>
        );
    }

    if (allQuestions.length === 0) {
        return (
            <div className="flex flex-col min-h-screen justify-center items-center p-4">
                <div className="glass-panel p-6 text-center space-y-4 max-w-sm border-[#b6ecff] dark:border-[#262626]">
                    <p className="text-sm font-semibold text-white">Este cuestionario no tiene preguntas activas.</p>
                    <button onClick={() => router.push('/')} className="px-4 py-2 bg-[#ff7a39] text-white text-xs font-bold rounded-lg">{t('back')}</button>
                </div>
            </div>
        );
    }

    if (cuestionario.presentacion_unica === 1) {
        return (
            <div className="flex flex-col min-h-screen text-slate-800 dark:text-[#fafafa] relative overflow-hidden justify-between p-6">
                
                {/* Header: Title and Save Draft button */}
                <header className="flex justify-between items-center z-10 mb-6">
                    <div>
                        <h1 className="text-lg font-black tracking-tight text-white dark:text-[#fafafa]">{cuestionario.nombre}</h1>
                        <span className="text-[10px] text-slate-400 font-semibold uppercase">
                            {language === 'es' ? 'Presentación Única • Todas las preguntas' : 'Single Page Layout • All questions'}
                        </span>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleSaveDraft}
                            disabled={savingAnswers}
                            className="px-4 py-2 text-xs font-bold uppercase border border-[#b6ecff]/50 dark:border-[#262626] rounded-xl hover:border-[#ff7a39] text-slate-700 hover:text-white transition-all disabled:opacity-50"
                        >
                            {savingAnswers ? t('loading') : t('saveAndContinue')}
                        </button>
                    </div>
                </header>

                {/* Glowing backgrounds */}
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-500/10 blur-[120px] pointer-events-none" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-orange-500/10 blur-[120px] pointer-events-none" />

                {/* Questions List */}
                <main className="flex-1 max-w-2xl w-full mx-auto space-y-6 z-10 pb-12">
                    {allQuestions.map((q, idx) => {
                        const ans = answers[q.id] || { text: '', options: [], associations: {} };
                        
                        // Check if section changed to show a section header
                        const showSecHeader = idx === 0 || allQuestions[idx - 1].seccion_id !== q.seccion_id;
                        
                        return (
                            <div key={q.id} id={`pregunta-container-${q.id}`} className="space-y-4">
                                {showSecHeader && q.seccion_nombre && (
                                    <div className="pt-4 pb-2 border-b border-[#b6ecff]/20 dark:border-[#262626]">
                                        <h3 className="text-xs font-black uppercase tracking-widest text-[#00aae1] flex items-center gap-1.5">
                                            📁 {q.seccion_nombre}
                                        </h3>
                                    </div>
                                )}
                                
                                <div className="w-full glass-panel p-6 border-[#b6ecff] dark:border-[#262626] shadow-xl space-y-4 transition-all hover:border-[#b6ecff]/40 dark:hover:border-[#383838]">
                                    {/* Question header */}
                                    <div>
                                        <span className="text-[9px] font-extrabold uppercase tracking-widest text-[#ff7a39] mb-1 block">
                                            {q.codigo} {q.obligatoria === 1 ? `* ${t('required')}` : ''}
                                        </span>
                                        <h2 className="text-md font-bold text-white dark:text-[#fafafa] leading-snug">
                                            {q.texto_pregunta}
                                        </h2>
                                    </div>

                                    <hr className="border-[#b6ecff]/10 dark:border-[#202020]" />

                                    {/* Question Inputs */}
                                    <div className="w-full">
                                        {/* ABIERTA */}
                                        {q.tipo_codigo === 'ABIERTA' && (
                                            <textarea
                                                value={ans.text || ''}
                                                onChange={(e) => setOpenTextVal(q.id, e.target.value)}
                                                placeholder={language === 'es' ? 'Escriba su respuesta aquí...' : 'Write your answer here...'}
                                                rows="3"
                                                className="w-full p-4 rounded-xl bg-white/40 dark:bg-black/20 border border-[#b6ecff] dark:border-[#262626] text-white dark:text-[#fafafa] placeholder-slate-400 focus:outline-none focus:border-[#00aae1] focus:ring-1 focus:ring-[#00aae1] transition-all text-sm font-medium resize-none"
                                            />
                                        )}

                                        {/* UNICA */}
                                        {q.tipo_codigo === 'UNICA' && (
                                            <div className="w-full space-y-2">
                                                {q.opciones && q.opciones.map(op => {
                                                    const isSelected = ans.options.includes(op.id.toString());
                                                    return (
                                                        <div
                                                            key={op.id}
                                                            onClick={() => toggleOptionVal(q.id, op.id, true)}
                                                            className={`w-full p-3.5 rounded-xl border cursor-pointer flex justify-between items-center transition-all ${
                                                                isSelected 
                                                                    ? 'bg-[#00aae1]/10 border-[#00aae1] text-[#00aae1] scale-[1.005]' 
                                                                    : 'bg-white/40 dark:bg-black/10 border-[#b6ecff]/50 dark:border-[#262626] text-white hover:border-[#00aae1]'
                                                            }`}
                                                        >
                                                            <span className="text-xs font-bold">{op.texto_opcion}</span>
                                                            <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-[#00aae1]' : 'border-slate-500'}`}>
                                                                {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-[#00aae1]"></div>}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* MULTIPLE */}
                                        {q.tipo_codigo === 'MULTIPLE' && (
                                            <div className="w-full space-y-2">
                                                {q.opciones && q.opciones.map(op => {
                                                    const isSelected = ans.options.includes(op.id.toString());
                                                    return (
                                                        <div
                                                            key={op.id}
                                                            onClick={() => toggleOptionVal(q.id, op.id, false)}
                                                            className={`w-full p-3.5 rounded-xl border cursor-pointer flex justify-between items-center transition-all ${
                                                                isSelected 
                                                                    ? 'bg-[#01ae6c]/10 border-[#01ae6c] text-[#01ae6c] scale-[1.005]' 
                                                                    : 'bg-white/40 dark:bg-black/10 border-[#b6ecff]/50 dark:border-[#262626] text-white hover:border-[#01ae6c]'
                                                            }`}
                                                        >
                                                            <span className="text-xs font-bold">{op.texto_opcion}</span>
                                                            <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${isSelected ? 'border-[#01ae6c] bg-[#01ae6c]' : 'border-slate-500'}`}>
                                                                {isSelected && <span className="text-white text-[9px] font-bold">✓</span>}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* ASOCIATIVA */}
                                        {q.tipo_codigo === 'ASOCIATIVA' && (
                                            <div className="w-full space-y-2">
                                                {q.asociaciones && q.asociaciones.map((a) => {
                                                    const matched = (ans.associations || {})[a.item_izquierdo] || '';
                                                    return (
                                                        <div key={a.id} className="grid grid-cols-2 gap-3 items-center">
                                                            <div className="p-3 rounded-lg bg-white/20 dark:bg-black/10 border border-[#b6ecff]/20 text-xs font-bold text-white truncate">
                                                                {a.item_izquierdo}
                                                            </div>
                                                            <select
                                                                value={matched}
                                                                onChange={(e) => setAssociationVal(q.id, a.item_izquierdo, e.target.value)}
                                                                className="w-full p-3 rounded-lg bg-white/40 dark:bg-slate-800 border border-[#b6ecff]/40 dark:border-[#262626] text-xs font-semibold text-white focus:outline-none focus:border-[#00aae1]"
                                                            >
                                                                <option value="" className="text-slate-800 dark:text-white">-- {t('select')} --</option>
                                                                {q.asociaciones.map(opt => (
                                                                    <option key={opt.id} value={opt.item_derecho} className="text-slate-800 dark:text-white">
                                                                        {opt.item_derecho}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {/* Finalize Action Card */}
                    <div className="w-full glass-panel p-6 border-[#b6ecff] dark:border-[#262626] shadow-xl text-center space-y-4">
                        <h3 className="text-sm font-bold text-white">{language === 'es' ? '¿Ha finalizado de responder?' : 'Have you finished responding?'}</h3>
                        <p className="text-xs text-slate-400">{language === 'es' ? 'Asegúrese de responder todas las preguntas obligatorias antes de enviar.' : 'Make sure to answer all required questions before submitting.'}</p>
                        <button
                            onClick={handleFinalize}
                            disabled={savingAnswers}
                            className="w-full py-4 rounded-xl bg-gradient-to-r from-[#ff7a39] to-[#ff5a1f] hover:from-[#e06020] hover:to-[#e04a14] text-white font-bold text-xs uppercase tracking-wider shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
                        >
                            {savingAnswers ? (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                t('finalize')
                            )}
                        </button>
                    </div>
                </main>
            </div>
        );
    }

    // Set default empty answers if unassigned
    const activeAns = answers[activeQuestion.id] || { text: '', options: [], associations: {} };

    // Estimated progress percentage
    const progress = Math.min(100, Math.round(((currentIdx + 1) / allQuestions.length) * 100));

    return (
        <div className="flex flex-col min-h-screen text-slate-800 dark:text-[#fafafa] relative overflow-hidden justify-between p-6">
            
            {/* Header: Title and Save Draft button */}
            <header className="flex justify-between items-center z-10">
                <div>
                    <h1 className="text-md font-bold tracking-tight text-white dark:text-[#fafafa]">{cuestionario.nombre}</h1>
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">{language === 'es' ? 'Pregunta' : 'Question'} {currentIdx + 1} / {allQuestions.length}</span>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleSaveDraft}
                        disabled={savingAnswers}
                        className="px-4 py-2 text-xs font-bold uppercase border border-[#b6ecff]/50 dark:border-[#262626] rounded-xl hover:border-[#ff7a39] text-slate-700 hover:text-white transition-all disabled:opacity-50"
                    >
                        {savingAnswers ? t('loading') : t('saveAndContinue')}
                    </button>
                </div>
            </header>

            {/* Glowing backgrounds */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-500/10 blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-orange-500/10 blur-[120px] pointer-events-none" />

            {/* Question Wizard Box */}
            <main className="flex-1 flex flex-col justify-center items-center max-w-xl w-full mx-auto py-8 z-10">
                <div className="w-full glass-panel p-8 border-[#b6ecff] dark:border-[#262626] shadow-2xl relative space-y-6 animate-slide-in">
                    
                    {/* Question text */}
                    <div>
                        {cuestionario.secciones && cuestionario.secciones.length > 1 && activeQuestion.seccion_nombre && (
                            <span className="text-[10px] font-black uppercase tracking-widest text-[#00aae1] mb-1.5 block">
                                📁 {activeQuestion.seccion_nombre}
                            </span>
                        )}
                        <span className="text-[9px] font-extrabold uppercase tracking-widest text-[#ff7a39] mb-1 block">
                            {activeQuestion.codigo} {activeQuestion.obligatoria === 1 ? `* ${t('required')}` : ''}
                        </span>
                        <h2 className="text-lg md:text-xl font-bold text-white dark:text-[#fafafa] leading-snug">
                            {activeQuestion.texto_pregunta}
                        </h2>
                    </div>

                    <hr className="border-[#b6ecff]/20 dark:border-[#262626]" />

                    {/* Question inputs selector depending on type */}
                    <div className="min-h-[140px] flex items-center justify-center w-full">
                        
                        {/* ABIERTA text input */}
                        {activeQuestion.tipo_codigo === 'ABIERTA' && (
                            <textarea
                                value={activeAns.text}
                                onChange={(e) => setOpenTextVal(activeQuestion.id, e.target.value)}
                                placeholder={language === 'es' ? 'Escriba su respuesta aquí...' : 'Write your answer here...'}
                                rows="4"
                                className="w-full p-4 rounded-xl bg-white/40 dark:bg-black/20 border border-[#b6ecff] dark:border-[#262626] text-white dark:text-[#fafafa] placeholder-slate-400 focus:outline-none focus:border-[#00aae1] focus:ring-1 focus:ring-[#00aae1] transition-all text-sm font-medium resize-none"
                            />
                        )}

                        {/* UNICA selection (Radio) */}
                        {activeQuestion.tipo_codigo === 'UNICA' && (
                            <div className="w-full space-y-2">
                                {activeQuestion.opciones && activeQuestion.opciones.map(op => {
                                    const isSelected = activeAns.options.includes(op.id.toString());
                                    return (
                                        <div
                                            key={op.id}
                                            onClick={() => toggleOptionVal(activeQuestion.id, op.id, true)}
                                            className={`w-full p-4 rounded-xl border cursor-pointer flex justify-between items-center transition-all ${
                                                isSelected 
                                                    ? 'bg-[#00aae1]/10 border-[#00aae1] text-[#00aae1] scale-[1.01]' 
                                                    : 'bg-white/40 dark:bg-black/10 border-[#b6ecff]/50 dark:border-[#262626] text-white hover:border-[#00aae1]'
                                            }`}
                                        >
                                            <span className="text-sm font-bold">{op.texto_opcion}</span>
                                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-[#00aae1]' : 'border-slate-500'}`}>
                                                {isSelected && <div className="w-2 h-2 rounded-full bg-[#00aae1]"></div>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* MULTIPLE selection (Checkboxes) */}
                        {activeQuestion.tipo_codigo === 'MULTIPLE' && (
                            <div className="w-full space-y-2">
                                {activeQuestion.opciones && activeQuestion.opciones.map(op => {
                                    const isSelected = activeAns.options.includes(op.id.toString());
                                    return (
                                        <div
                                            key={op.id}
                                            onClick={() => toggleOptionVal(activeQuestion.id, op.id, false)}
                                            className={`w-full p-4 rounded-xl border cursor-pointer flex justify-between items-center transition-all ${
                                                isSelected 
                                                    ? 'bg-[#01ae6c]/10 border-[#01ae6c] text-[#01ae6c] scale-[1.01]' 
                                                    : 'bg-white/40 dark:bg-black/10 border-[#b6ecff]/50 dark:border-[#262626] text-white hover:border-[#01ae6c]'
                                            }`}
                                        >
                                            <span className="text-sm font-bold">{op.texto_opcion}</span>
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'border-[#01ae6c] bg-[#01ae6c]' : 'border-slate-500'}`}>
                                                {isSelected && <span className="text-white text-[10px]">✓</span>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* ASOCIATIVA matching columns */}
                        {activeQuestion.tipo_codigo === 'ASOCIATIVA' && (
                            <div className="w-full space-y-3">
                                {activeQuestion.asociaciones && activeQuestion.asociaciones.map((a, idx) => {
                                    const matched = (activeAns.associations || {})[a.item_izquierdo] || '';
                                    return (
                                        <div key={a.id} className="grid grid-cols-2 gap-3 items-center">
                                            <div className="p-3 rounded-lg bg-white/20 dark:bg-black/10 border border-[#b6ecff]/20 text-xs font-bold text-white truncate">
                                                {a.item_izquierdo}
                                            </div>
                                            <select
                                                value={matched}
                                                onChange={(e) => setAssociationVal(activeQuestion.id, a.item_izquierdo, e.target.value)}
                                                className="w-full p-3 rounded-lg bg-white/40 dark:bg-slate-800 border border-[#b6ecff]/40 dark:border-[#262626] text-xs font-semibold text-white focus:outline-none focus:border-[#00aae1]"
                                            >
                                                <option value="" className="text-slate-800 dark:text-white">-- {t('select')} --</option>
                                                {activeQuestion.asociaciones.map(opt => (
                                                    <option key={opt.id} value={opt.item_derecho} className="text-slate-800 dark:text-white">
                                                        {opt.item_derecho}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Footer controls: Back, Next/Submit, and Progress bar */}
            <footer className="w-full max-w-xl mx-auto space-y-4 z-10 pt-4">
                
                {/* buttons row */}
                <div className="flex justify-between items-center gap-3">
                    <button
                        onClick={handleBack}
                        disabled={history.length === 0}
                        className="px-5 py-3 rounded-xl border border-[#b6ecff]/50 dark:border-[#262626] text-xs font-bold uppercase tracking-wider text-slate-700 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        ◀ {t('back')}
                    </button>

                    <button
                        onClick={handleNext}
                        disabled={savingAnswers}
                        className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#ff7a39] to-[#ff5a1f] hover:from-[#e06020] hover:to-[#e04a14] text-white font-bold text-xs uppercase tracking-wider shadow-md transition-all active:scale-[0.98] flex items-center gap-1.5"
                    >
                        {savingAnswers ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : currentIdx === allQuestions.length - 1 ? (
                            t('finalize')
                        ) : (
                            `${t('next')} ▶`
                        )}
                    </button>
                </div>

                {/* progress bar */}
                <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-bold text-slate-400">
                        <span>{t('completionRate')}</span>
                        <span>{progress}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-300 dark:bg-slate-700/50 rounded-full overflow-hidden shadow-inner">
                        <div className="h-full bg-gradient-to-r from-[#00aae1] to-[#06b6d4] transition-all duration-300 rounded-full" style={{ width: `${progress}%` }}></div>
                    </div>
                </div>
            </footer>
        </div>
    );
}

// ---------------------------------------------------------------------------
// PrintResultModal: renders the completed questionnaire with actual answers
function PrintResultModal({ cuestionario, responseId, resultData, hasScore, answers, allQuestions, language, onClose }) {
    const isClinical = parseInt(cuestionario?.id_tipo_cuestionario) === 2;
    const colorMap = {
        green: '#16a34a',
        orange: '#ea580c',
        red: '#dc2626',
        blue: '#2563eb',
        grey: '#64748b'
    };
    const accentColor = colorMap[resultData?.color] || colorMap.grey;

    const handlePrint = () => window.print();

    const loc = language === 'es' ? 'es-ES' : 'en-US';
    const now = new Date().toLocaleDateString(loc, { day: 'numeric', month: 'short', year: 'numeric' });

    // Helper: get the answer object for a question
    const getAns = (qId) => answers[qId] || { text: '', options: [], associations: {} };

    // Helper: render single question markup
    const renderQuestionMarkup = (q, idx) => {
        const ans = getAns(q.id);
        let assocMap = ans.associations || {};
        return (
            <div key={q.id || idx} className="border-b border-slate-200 pb-5 last:border-0 print:avoid-break">
                {/* Question header */}
                <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-start gap-2">
                        <span className="text-[10px] font-black text-white px-2 py-0.5 rounded shrink-0" style={{ background: '#ff7a39' }}>
                            {q.codigo || `P${idx + 1}`}
                        </span>
                        <p className="text-sm font-extrabold text-slate-800 leading-snug">{q.texto_pregunta}</p>
                    </div>
                    {q.obligatoria === 1 && (
                        <span className="text-[9px] font-extrabold text-red-500 shrink-0 uppercase tracking-wider">*{language === 'es' ? 'Req.' : 'Req.'}</span>
                    )}
                </div>

                {/* ABIERTA */}
                {q.tipo_codigo === 'ABIERTA' && (
                    <div className="ml-1 p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 font-semibold min-h-[40px]">
                        {ans.text && ans.text.trim() !== '' ? ans.text : (
                            <span className="text-slate-400 italic">{language === 'es' ? '(Sin respuesta)' : '(No answer)'}</span>
                        )}
                    </div>
                )}

                {/* UNICA */}
                {q.tipo_codigo === 'UNICA' && (
                    <div className="ml-1 space-y-1.5">
                        {(q.opciones || []).map(op => {
                            const isSelected = ans.options.includes(op.id.toString());
                            return (
                                <div key={op.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all ${
                                    isSelected ? 'bg-[#00aae1]/10 border border-[#00aae1]/30 font-bold text-slate-800' : 'text-slate-500'
                                }`}>
                                    <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${
                                        isSelected ? 'border-[#00aae1]' : 'border-slate-300'
                                    }`}>
                                        {isSelected && <div className="w-2 h-2 rounded-full bg-[#00aae1]" />}
                                    </div>
                                    <span>{op.texto_opcion}</span>
                                    {hasScore && isSelected && op.valor_opcion > 0 && (
                                        <span className="ml-auto text-[9px] font-extrabold text-[#00aae1]">
                                            +{op.valor_opcion} pts
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* MULTIPLE */}
                {q.tipo_codigo === 'MULTIPLE' && (
                    <div className="ml-1 space-y-1.5">
                        {(q.opciones || []).map(op => {
                            const isSelected = ans.options.includes(op.id.toString());
                            return (
                                <div key={op.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all ${
                                    isSelected ? 'bg-[#01ae6c]/10 border border-[#01ae6c]/30 font-bold text-slate-800' : 'text-slate-500'
                                }`}>
                                    <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                                        isSelected ? 'border-[#01ae6c] bg-[#01ae6c]' : 'border-slate-300'
                                    }`}>
                                        {isSelected && <span className="text-white text-[9px] font-black">✓</span>}
                                    </div>
                                    <span>{op.texto_opcion}</span>
                                    {hasScore && isSelected && op.valor_opcion > 0 && (
                                        <span className="ml-auto text-[9px] font-extrabold text-[#01ae6c]">
                                            +{op.valor_opcion} pts
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* ASOCIATIVA */}
                {q.tipo_codigo === 'ASOCIATIVA' && (
                    <div className="ml-1 bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                        <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider block">
                            {language === 'es' ? 'Correspondencias' : 'Matches'}
                        </span>
                        {(q.asociaciones || []).map(assoc => {
                            const matchedDer = assocMap[assoc.item_izquierdo] || '';
                            const isCorrect = matchedDer === assoc.item_derecho;
                            const hasAnswer = matchedDer !== '';
                            return (
                                <div key={assoc.id} className={`rounded-lg border px-3 py-2 text-xs ${
                                    !hasAnswer ? 'border-slate-200 bg-white' :
                                    isCorrect ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                                }`}>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-sm font-black shrink-0 ${
                                            !hasAnswer ? 'text-slate-300' :
                                            isCorrect ? 'text-green-600' : 'text-red-500'
                                        }`}>
                                            {!hasAnswer ? '○' : isCorrect ? '✓' : '✗'}
                                        </span>

                                        <span className="font-semibold text-slate-700 shrink-0">{assoc.item_izquierdo}</span>
                                        <span className="text-slate-300 px-1">→</span>

                                        {hasAnswer ? (
                                            <span className={`font-bold ${isCorrect ? 'text-green-700' : 'text-red-600 line-through'}`}>
                                                {matchedDer}
                                            </span>
                                        ) : (
                                            <span className="text-slate-400 italic">{language === 'es' ? '(Sin respuesta)' : '(No answer)'}</span>
                                        )}

                                        {hasScore && hasAnswer && (
                                            <span className={`ml-auto text-[9px] font-extrabold shrink-0 ${isCorrect ? 'text-green-600' : 'text-red-500'}`}>
                                                {isCorrect ? `+${assoc.valor_correcto || 0}` : '0'} pts
                                            </span>
                                        )}
                                    </div>

                                    {hasAnswer && !isCorrect && (
                                        <div className="mt-1.5 flex items-center gap-1.5 pl-6 text-[10px] text-green-700 font-semibold border-t border-red-100 pt-1.5">
                                            <span className="font-black text-green-600">✓</span>
                                            <span>{language === 'es' ? 'Correcto:' : 'Correct:'}</span>
                                            <span className="font-bold">{assoc.item_derecho}</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex flex-col overflow-auto">
            {/* Toolbar — hidden on print */}
            <div className="no-print sticky top-0 z-10 bg-slate-950/95 border-b border-slate-800 px-6 py-3 flex justify-between items-center gap-4">
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                    🖨️ {language === 'es' ? 'Vista Previa de Impresión' : 'Print Preview'}
                </span>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handlePrint}
                        className="px-5 py-2 rounded-lg bg-gradient-to-r from-[#ff7a39] to-[#ff5a1f] text-white font-extrabold text-xs uppercase tracking-wider shadow-md transition-all active:scale-[0.98]"
                    >
                        🖨️ {language === 'es' ? 'Imprimir / PDF' : 'Print / PDF'}
                    </button>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg border border-slate-700 text-xs font-bold text-slate-300 hover:border-red-500 hover:text-red-400 transition-all"
                    >
                        ✕ {language === 'es' ? 'Cerrar' : 'Close'}
                    </button>
                </div>
            </div>

            {/* Document area */}
            <div className="flex-1 flex justify-center items-start py-8 px-4 overflow-auto">
                <div className="print-area w-full max-w-3xl bg-white text-slate-800 p-10 shadow-2xl rounded-xl h-fit">

                     {/* Institutional Header */}
                     <div className="flex justify-between items-start border-b-2 border-slate-300 pb-5 mb-6">
                         <div className="flex gap-4 items-center">
                             <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-sm" style={{ background: 'linear-gradient(135deg, #ff7a39, #ff5a1f)' }}>
                                 <span className="text-white font-bold text-xl">T</span>
                             </div>
                             <div>
                                 <h2 className="text-md font-extrabold uppercase tracking-wide text-slate-800">Teker Apps</h2>
                                 <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                                     {language === 'es' ? 'Reporte de Evaluación' : 'Evaluation Report'}
                                 </p>
                             </div>
                         </div>
                         <div className="text-right">
                             <span className="text-xs font-bold text-slate-500 uppercase block">{language === 'es' ? 'Fecha' : 'Date'}</span>
                             <span className="text-xs font-extrabold text-slate-800">{now}</span>
                         </div>
                     </div>

                     {/* Title */}
                     <h1 className="text-2xl font-black text-slate-800 tracking-tight mb-1">{cuestionario.nombre}</h1>
                     {cuestionario.descripcion && (
                         <p className="text-xs text-slate-500 italic mb-6">{cuestionario.descripcion}</p>
                     )}

                     {/* Score block — only when questionnaire has scoring ranges configured */}
                     {isClinical ? (
                         <div className="mb-8 border border-slate-200 rounded-xl overflow-hidden">
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
                                     {(resultData?.resultados_clinicos || []).map((varCli, index) => {
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
                     ) : (
                         hasScore && (
                             <div className="mb-8 p-5 rounded-xl border-2" style={{ borderColor: accentColor, color: accentColor, background: accentColor + '10' }}>
                                 <div className="flex items-center gap-3 mb-2">
                                     <span className="text-xs font-extrabold uppercase tracking-widest opacity-70">{language === 'es' ? 'Puntaje Total:' : 'Total Score:'}</span>
                                     <span className="text-3xl font-black">{resultData.puntaje_total ?? 0}</span>
                                 </div>
                                 {resultData.clasificacion_final && resultData.clasificacion_final.trim() !== '' && (
                                     <div className="flex items-center gap-3">
                                         <span className="text-xs font-extrabold uppercase tracking-widest opacity-70">{language === 'es' ? 'Clasificación:' : 'Classification:'}</span>
                                         <span className="text-lg font-extrabold">{resultData.clasificacion_final}</span>
                                     </div>
                                 )}
                             </div>
                         )
                     )}

                     {/* Questions with actual answers */}
                     {cuestionario.secciones && cuestionario.secciones.length > 1 ? (
                         cuestionario.secciones.map((sec, secIdx) => {
                             const secQuestions = allQuestions.filter(q => q.seccion_id === sec.id);
                             if (secQuestions.length === 0) return null;
                             return (
                                 <div key={sec.id || secIdx} className="space-y-4 mb-8 print:avoid-break">
                                     <div className="bg-slate-100 p-2.5 rounded-lg border-l-4 border-[#ff7a39]">
                                         <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">{sec.nombre}</h3>
                                         {sec.descripcion && <p className="text-[10px] text-slate-500 italic mt-0.5">{sec.descripcion}</p>}
                                     </div>
                                     <div className="space-y-6 pl-2">
                                         {secQuestions.map((q, idx) => renderQuestionMarkup(q, idx))}
                                     </div>
                                 </div>
                             );
                         })
                     ) : (
                         <div className="space-y-6">
                             {allQuestions.map((q, idx) => renderQuestionMarkup(q, idx))}
                         </div>
                     )}

                     {/* Signatures */}
                     <div className="mt-16 pt-8 border-t-2 border-slate-300 grid grid-cols-2 gap-12">
                         <div className="text-center">
                             <div className="h-14" />
                             <div className="border-t border-slate-400 pt-2 text-xs font-bold text-slate-700 uppercase tracking-wide">
                                 {language === 'es' ? 'Firma del Evaluador' : 'Evaluator Signature'}
                             </div>
                         </div>
                         <div className="text-center">
                             <div className="h-14" />
                             <div className="border-t border-slate-400 pt-2 text-xs font-bold text-slate-700 uppercase tracking-wide">
                                 {language === 'es' ? 'Firma del Paciente' : 'Patient Signature'}
                             </div>
                         </div>
                     </div>
                </div>
            </div>

            {/* Print-only CSS — hides everything except .print-area */}
            <style>{`
                @media print {
                    body > * { display: none !important; }
                    .print-area {
                        display: block !important;
                        position: relative !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        margin: 0 !important;
                        padding: 32px !important;
                        background: #ffffff !important;
                        color: #1e293b !important;
                        box-shadow: none !important;
                        border-radius: 0 !important;
                        height: auto !important;
                    }
                }
            `}</style>
        </div>
    );
}
