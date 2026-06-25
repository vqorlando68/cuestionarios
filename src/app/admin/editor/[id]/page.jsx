'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useCuestionariosContext } from '@/context/CuestionariosContext';
const syncQuestionCodes = (cuest) => {
    if (!cuest) return cuest;

    // We need to map old codes to new codes so we can update flows
    const oldToNewCodes = {};
    
    // Walk through all active questions in order of their sections and visual sequence
    let overallIndex = 1;
    const updatedSecciones = (cuest.secciones || []).map(sec => {
        const updatedPreguntas = (sec.preguntas || []).map(q => {
            const oldCode = q.codigo;
            const newCode = `P-${overallIndex}`;
            oldToNewCodes[oldCode] = newCode;
            
            overallIndex++;

            return {
                ...q,
                codigo: newCode,
                orden_visual: overallIndex - 1 // flat sequential order
            };
        });
        return {
            ...sec,
            preguntas: updatedPreguntas
        };
    });

    // Update all flows with the new codes
    const updatedFlujos = (cuest.flujos || []).map(flow => {
        const newOrigin = oldToNewCodes[flow.codigo_pregunta_origen] || flow.codigo_pregunta_origen;
        const newDest = oldToNewCodes[flow.codigo_pregunta_destino] || flow.codigo_pregunta_destino;
        return {
            ...flow,
            codigo_pregunta_origen: newOrigin,
            codigo_pregunta_destino: newDest
        };
    });

    return {
        ...cuest,
        secciones: updatedSecciones,
        flujos: updatedFlujos
    };
};

export default function Editor() {
    const { id } = useParams();
    const router = useRouter();
    const { 
        alert, confirm, user, t, language, theme, toggleTheme,
        fetchCuestionarioDetalle, currentCuestionario, saveCuestionario, changeEstadoCuestionario
    } = useCuestionariosContext();

    const plsqlDocs = useMemo(() => {
        return {
            obtener_cuestionarios: {
                name: 'pkgln_cuestionarios.sp_obtener_cuestionarios',
                descEs: 'Obtiene el listado completo de cuestionarios activos con estadísticas de respuestas acumuladas.',
                descEn: 'Gets the complete list of active questionnaires along with cumulative response statistics.',
                params: [],
                outputEs: 'Retorna un objeto JSON con la clave success en true y data que contiene el arreglo de cuestionarios y su tasa de finalización.',
                outputEn: 'Returns a JSON object with success as true and data containing the array of questionnaires and their completion rate.',
                code: `-- Ejemplo de llamado en Oracle SQL / PL/SQL
DECLARE
  v_input   CLOB := '{}';
  v_output  CLOB;
  v_success NUMBER;
BEGIN
  pkgln_cuestionarios.sp_obtener_cuestionarios(
    p_input   => v_input,
    p_output  => v_output,
    p_success => v_success
  );
  DBMS_OUTPUT.put_line(v_output);
END;`
            },
            obtener_cuestionario_detalle: {
                name: 'pkgln_cuestionarios.sp_obtener_cuestionario_detalle',
                descEs: 'Obtiene la definición y estructura completa de un cuestionario específico por su ID (incluye secciones, preguntas, opciones, correspondencias, flujos, reglas, variables y resultados).',
                descEn: 'Gets the complete definition and structure of a specific questionnaire by ID (includes sections, questions, options, matchings, flows, rules, variables, and results).',
                params: [
                    { name: 'id', type: 'NUMBER', required: true, descEs: 'ID único del cuestionario en la tabla TKR_CUESTIONARIOS.', descEn: 'Unique ID of the questionnaire in TKR_CUESTIONARIOS table.' }
                ],
                outputEs: 'Retorna un objeto JSON con la estructura completa del cuestionario jerárquico.',
                outputEn: 'Returns a JSON object with the complete hierarchical structure of the questionnaire.',
                code: `-- Ejemplo de llamado en Oracle SQL / PL/SQL
DECLARE
  v_input   CLOB := '{"id": 41}';
  v_output  CLOB;
  v_success NUMBER;
BEGIN
  pkgln_cuestionarios.sp_obtener_cuestionario_detalle(
    p_input   => v_input,
    p_output  => v_output,
    p_success => v_success
  );
  DBMS_OUTPUT.put_line(v_output);
END;`
            },
            guardar_cuestionario: {
                name: 'pkgln_cuestionarios.sp_guardar_cuestionario',
                descEs: 'Guarda o actualiza un cuestionario completo. Si el cuestionario ya cuenta con respuestas, crea automáticamente una nueva versión en borrador incrementando el número de versión para evitar corromper el histórico.',
                descEn: 'Saves or updates a complete questionnaire. If it already has responses, it automatically creates a new draft version by incrementing the version number to prevent historical data corruption.',
                params: [
                    { name: 'id', type: 'NUMBER', required: false, descEs: 'ID del cuestionario a actualizar (si se omite o es NULL se creará un cuestionario nuevo).', descEn: 'ID of the questionnaire to update (if omitted or NULL, a new questionnaire is created).' },
                    { name: 'nombre', type: 'VARCHAR2', required: true, descEs: 'Nombre o título de la evaluación.', descEn: 'Name or title of the assessment.' },
                    { name: 'descripcion', type: 'VARCHAR2', required: false, descEs: 'Breve descripción clínica o informativa.', descEn: 'Brief clinical or informative description.' },
                    { name: 'publicado', type: 'NUMBER', required: false, descEs: '1 para publicarlo inmediatamente, 0 para guardarlo como borrador.', descEn: '1 to publish immediately, 0 to save as draft.' },
                    { name: 'version', type: 'NUMBER', required: false, descEs: 'Número de versión a actualizar.', descEn: 'Version number to update.' },
                    { name: 'secciones', type: 'ARRAY', required: false, descEs: 'Listado de secciones con preguntas, opciones y correspondencias.', descEn: 'List of sections containing questions, options, and matchings.' },
                    { name: 'flujos', type: 'ARRAY', required: false, descEs: 'Listado de reglas condicionales y saltos lógicos.', descEn: 'List of conditional rules and logic jumps.' },
                    { name: 'variables', type: 'ARRAY', required: false, descEs: 'Listado de variables calculadas mediante expresiones algebraicas.', descEn: 'List of calculated variables using algebraic expressions.' },
                    { name: 'resultados', type: 'ARRAY', required: false, descEs: 'Listado de rangos de resultados finales y clasificaciones.', descEn: 'List of score ranges for final results and classifications.' }
                ],
                outputEs: 'Retorna el ID y número de versión asignada en formato JSON.',
                outputEn: 'Returns the ID and version number assigned in JSON format.',
                code: `-- Ejemplo de llamado en Oracle SQL / PL/SQL
DECLARE
  v_input   CLOB := '{"id":null,"nombre":"Cuestionario Nuevo","secciones":[{"nombre":"Fase 1","orden_visual":1,"preguntas":[{"tipo_codigo":"UNICA","codigo":"P1","texto_pregunta":"¿Fuma?","opciones":[{"texto_opcion":"Sí","codigo_opcion":"OP1","valor_opcion":5}]}]}]}';
  v_output  CLOB;
  v_success NUMBER;
BEGIN
  pkgln_cuestionarios.sp_guardar_cuestionario(
    p_input   => v_input,
    p_output  => v_output,
    p_success => v_success
  );
  DBMS_OUTPUT.put_line(v_output);
END;`
            },
            duplicar_cuestionario: {
                name: 'pkgln_cuestionarios.sp_duplicar_cuestionario',
                descEs: 'Duplica de manera profunda un cuestionario con todos sus elementos asociados (preguntas, opciones, flujos, reglas, etc.) asignándole un nuevo nombre.',
                descEn: 'Performs a deep duplicate of a questionnaire with all its associated elements (questions, options, flows, rules, etc.) under a new name.',
                params: [
                    { name: 'id', type: 'NUMBER', required: true, descEs: 'ID del cuestionario origen a duplicar.', descEn: 'ID of the source questionnaire to duplicate.' },
                    { name: 'nuevo_nombre', type: 'VARCHAR2', required: true, descEs: 'Nombre para el cuestionario clonado.', descEn: 'Name for the cloned questionnaire.' }
                ],
                outputEs: 'Retorna el ID del nuevo cuestionario en un JSON.',
                outputEn: 'Returns the ID of the new questionnaire in JSON.',
                code: `-- Ejemplo de llamado en Oracle SQL / PL/SQL
DECLARE
  v_input   CLOB := '{"id": 41, "nuevo_nombre": "Cuestionario Copiado"}';
  v_output  CLOB;
  v_success NUMBER;
BEGIN
  pkgln_cuestionarios.sp_duplicar_cuestionario(
    p_input   => v_input,
    p_output  => v_output,
    p_success => v_success
  );
  DBMS_OUTPUT.put_line(v_output);
END;`
            },
            cambiar_estado_cuestionario: {
                name: 'pkgln_cuestionarios.sp_cambiar_estado_cuestionario',
                descEs: 'Cambia el estado de publicación o realiza la eliminación lógica de un cuestionario.',
                descEn: 'Changes publication status or performs soft-delete on a questionnaire.',
                params: [
                    { name: 'id', type: 'NUMBER', required: true, descEs: 'ID del cuestionario.', descEn: 'ID of the questionnaire.' },
                    { name: 'accion', type: 'VARCHAR2', required: true, descEs: 'Acción a realizar: "publish", "draft" o "delete".', descEn: 'Action to perform: "publish", "draft", or "delete".' }
                ],
                outputEs: 'Retorna un objeto JSON con el indicador success.',
                outputEn: 'Returns a JSON object with success indicator.',
                code: `-- Ejemplo de llamado en Oracle SQL / PL/SQL
DECLARE
  v_input   CLOB := '{"id": 41, "accion": "publish"}';
  v_output  CLOB;
  v_success NUMBER;
BEGIN
  pkgln_cuestionarios.sp_cambiar_estado_cuestionario(
    p_input   => v_input,
    p_output  => v_output,
    p_success => v_success
  );
  DBMS_OUTPUT.put_line(v_output);
END;`
            },
            iniciar_respuesta: {
                name: 'pkgln_cuestionarios.sp_iniciar_respuesta',
                descEs: 'Registra el inicio de una sesión para responder un cuestionario. Genera un ID de sesión que sirve para rastrear las respuestas asociadas.',
                descEn: 'Registers the start of a session to respond to a questionnaire. Generates a session ID to track answers.',
                params: [
                    { name: 'id_cuestionario', type: 'NUMBER', required: true, descEs: 'ID del cuestionario a responder.', descEn: 'ID of the questionnaire to respond.' },
                    { name: 'id_usuario', type: 'NUMBER', required: false, descEs: 'ID del usuario que responde (médico/paciente).', descEn: 'ID of the user responding (doctor/patient).' }
                ],
                outputEs: 'Retorna el id_cuestionario_respuesta asignado en JSON.',
                outputEn: 'Returns the assigned id_cuestionario_respuesta in JSON.',
                code: `-- Ejemplo de llamado en Oracle SQL / PL/SQL
DECLARE
  v_input   CLOB := '{"id_cuestionario": 41, "id_usuario": 1}';
  v_output  CLOB;
  v_success NUMBER;
BEGIN
  pkgln_cuestionarios.sp_iniciar_respuesta(
    p_input   => v_input,
    p_output  => v_output,
    p_success => v_success
  );
  DBMS_OUTPUT.put_line(v_output);
END;`
            },
            guardar_respuestas: {
                name: 'pkgln_cuestionarios.sp_guardar_respuestas',
                descEs: 'Guarda respuestas parciales o totales asociadas a una sesión activa del diligenciador.',
                descEn: 'Saves partial or complete answers associated with an active responder session.',
                params: [
                    { name: 'id_cuestionario_respuesta', type: 'NUMBER', required: true, descEs: 'ID de la sesión de respuesta generada al iniciar.', descEn: 'ID of the response session generated at start.' },
                    { name: 'respuestas', type: 'ARRAY', required: true, descEs: 'Arreglo de respuestas conteniendo id_pregunta, respuesta_texto (texto/asociación) y opciones_seleccionadas (arreglo de IDs de opciones).', descEn: 'Array of answers containing id_pregunta, respuesta_texto (text/association) and opciones_seleccionadas (array of option IDs).' }
                ],
                outputEs: 'Confirmación de éxito en formato JSON.',
                outputEn: 'Success confirmation in JSON format.',
                code: `-- Ejemplo de llamado en Oracle SQL / PL/SQL
DECLARE
  v_input   CLOB := '{"id_cuestionario_respuesta": 102, "respuestas": [{"id_pregunta": 501, "respuesta_texto": "Texto libre", "opciones_seleccionadas": [1201]}]}';
  v_output  CLOB;
  v_success NUMBER;
BEGIN
  pkgln_cuestionarios.sp_guardar_respuestas(
    p_input   => v_input,
    p_output  => v_output,
    p_success => v_success
  );
  DBMS_OUTPUT.put_line(v_output);
END;`
            },
            finalizar_cuestionario: {
                name: 'pkgln_cuestionarios.sp_finalizar_cuestionario',
                descEs: 'Finaliza el cuestionario y bloquea nuevas modificaciones. Evalúa las variables calculadas formuladas en el backend y clasifica el puntaje acumulado final en base a los rangos configurados.',
                descEn: 'Finalizes the questionnaire and locks it. Evaluates calculated variables on the backend and maps the final cumulative score to the configured ranges.',
                params: [
                    { name: 'id_cuestionario_respuesta', type: 'NUMBER', required: true, descEs: 'ID de la sesión de respuesta.', descEn: 'ID of the response session.' }
                ],
                outputEs: 'Retorna el puntaje_total, id_resultado, nombre_resultado, descripción y color semántico en JSON.',
                outputEn: 'Returns the total score, result ID, classification label, description, and status color in JSON.',
                code: `-- Ejemplo de llamado en Oracle SQL / PL/SQL
DECLARE
  v_input   CLOB := '{"id_cuestionario_respuesta": 102}';
  v_output  CLOB;
  v_success NUMBER;
BEGIN
  pkgln_cuestionarios.sp_finalizar_cuestionario(
    p_input   => v_input,
    p_output  => v_output,
    p_success => v_success
  );
  DBMS_OUTPUT.put_line(v_output);
END;`
            },
            obtener_respuesta_detalle: {
                name: 'pkgln_cuestionarios.sp_obtener_respuesta_detalle',
                descEs: 'Obtiene el detalle completo de una evaluación diligenciada para visualización e impresión, incluyendo las respuestas de cada pregunta y los resultados calculados.',
                descEn: 'Gets the complete detail of a filled assessment for viewing and printing, including individual answers and calculated outcomes.',
                params: [
                    { name: 'id_cuestionario_respuesta', type: 'NUMBER', required: true, descEs: 'ID de la sesión de respuestas.', descEn: 'ID of the response session.' }
                ],
                outputEs: 'Retorna JSON con metadatos del cuestionario finalizado y las respuestas registradas.',
                outputEn: 'Returns JSON with metadata of the finalized questionnaire and the recorded answers.',
                code: `-- Ejemplo de llamado en Oracle SQL / PL/SQL
DECLARE
  v_input   CLOB := '{"id_cuestionario_respuesta": 102}';
  v_output  CLOB;
  v_success NUMBER;
BEGIN
  pkgln_cuestionarios.sp_obtener_respuesta_detalle(
    p_input   => v_input,
    p_output  => v_output,
    p_success => v_success
  );
  DBMS_OUTPUT.put_line(v_output);
END;`
            },
            obtener_dashboard_stats: {
                name: 'pkgln_cuestionarios.sp_obtener_dashboard_stats',
                descEs: 'Obtiene las métricas de uso consolidado para el panel de administración.',
                descEn: 'Gets consolidated usage metrics for the administrative dashboard.',
                params: [],
                outputEs: 'Retorna JSON con métricas agregadas (formularios totales, respuestas registradas, tasa de finalización y tiempo promedio).',
                outputEn: 'Returns JSON with aggregated metrics (total questionnaires, answers recorded, completion rate, and average completion time).',
                code: `-- Ejemplo de llamado en Oracle SQL / PL/SQL
DECLARE
  v_input   CLOB := '{}';
  v_output  CLOB;
  v_success NUMBER;
BEGIN
  pkgln_cuestionarios.sp_obtener_dashboard_stats(
    p_input   => v_input,
    p_output  => v_output,
    p_success => v_success
  );
  DBMS_OUTPUT.put_line(v_output);
END;`
            }
        };
    }, []);

    const highlightPLSQL = (code) => {
        const keywords = ['DECLARE', 'BEGIN', 'END;', 'IN', 'OUT', 'PROCEDURE', 'VARCHAR2', 'NUMBER', 'CLOB', 'NULL', 'IS', 'AS', 'AND', 'OR', 'IF', 'THEN', 'ELSE', 'LOOP', 'COMMIT', 'ROLLBACK', 'SELECT', 'INTO', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'VALUES', 'SET', 'SYSDATE', 'TO_CHAR', 'CASE', 'WHEN', 'EXCEPTION', 'OTHERS'];
        let escaped = code
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        escaped = escaped.replace(/(--.*)/g, '<span class="text-[#6a9955]">$1</span>');
        escaped = escaped.replace(/('([^'\\]|\\.)*')/g, '<span class="text-[#ce9178]">$1</span>');
        keywords.forEach(kw => {
            const regex = new RegExp('\\\b(' + kw + ')\\\b', 'g');
            escaped = escaped.replace(regex, '<span class="text-[#569cd6] font-bold">$1</span>');
        });
        escaped = escaped.replace(/(pkgln_cuestionarios\.[a-zA-Z0-9_]+)/g, '<span class="text-[#dcdcaa] font-bold">$1</span>');
        escaped = escaped.replace(/(DBMS_OUTPUT\.[a-zA-Z0-9_]+)/g, '<span class="text-[#dcdcaa] font-bold">$1</span>');
        return <pre className="font-mono text-xs text-[#d4d4d4] leading-relaxed whitespace-pre-wrap select-text" dangerouslySetInnerHTML={{ __html: escaped }} />;
    };

    const [cuestionario, setCuestionario] = useState(null);
    const [loading, setLoading] = useState(true);

    const isReadOnly = cuestionario?.publicado === 1;
    
    // Editor UI States
    const [selectedQuestionId, setSelectedQuestionId] = useState(null);
    const [zoom, setZoom] = useState(1);
    const [activeSectionId, setActiveSectionId] = useState(null);
    const [saving, setSaving] = useState(false);
    const [showHelpModal, setShowHelpModal] = useState(false);
    const [activeHelpTab, setActiveHelpTab] = useState('secciones');
    const [showDevHelpModal, setShowDevHelpModal] = useState(false);
    const [activeDevTab, setActiveDevTab] = useState('obtener_cuestionarios');
    const [copiedId, setCopiedId] = useState(null);
    const [cardCoords, setCardCoords] = useState({});
    const [activePropsTab, setActivePropsTab] = useState('variables');

    // Drag-and-drop state
    const [dragOverIdx, setDragOverIdx] = useState(null);
    // useRef so the drag source index survives re-renders without stale closures
    const dragSrcIdxRef = useRef(null);




    // Load detailed data
    useEffect(() => {
        if (!user) {
            router.push('/');
            return;
        }

        const loadCuestionario = async () => {
            setLoading(true);
            const data = await fetchCuestionarioDetalle(id);
            if (data) {
                // Ensure array structures exist
                const normalized = {
                    ...data,
                    secciones: data.secciones || [],
                    flujos: data.flujos || [],
                    variables: data.variables || [],
                    resultados_clinicos: data.resultados_clinicos || [],
                    resultados: data.resultados || []
                };
                setCuestionario(syncQuestionCodes(normalized));
                if (normalized.secciones.length > 0) {
                    setActiveSectionId(normalized.secciones[0].id);
                }
            } else {
                router.push('/admin/dashboard');
            }
            setLoading(false);
        };
        loadCuestionario();
    }, [id, user, router, fetchCuestionarioDetalle]);

    // Keyboard shortcut for developer help modal (Ctrl+Alt+D)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.ctrlKey && e.altKey && e.key.toLowerCase() === 'd') {
                e.preventDefault();
                setShowDevHelpModal(prev => !prev);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);
 
    // Recalculate card coordinates inside scale container
    useEffect(() => {
        const activeSection = cuestionario?.secciones?.find(s => s.id === activeSectionId);
        if (!activeSection) return;

        const updateCoords = () => {
            const container = document.getElementById('canvas-scroll-container');
            const scaleContainer = document.getElementById('canvas-scale-container');
            if (!container || !scaleContainer) return;

            const scaleRect = scaleContainer.getBoundingClientRect();
            const newCoords = {};

            (activeSection.preguntas || []).forEach(q => {
                const el = document.getElementById(`card-${q.codigo}`);
                if (el) {
                    const rect = el.getBoundingClientRect();
                    const top = (rect.top - scaleRect.top) / zoom;
                    const bottom = (rect.bottom - scaleRect.top) / zoom;
                    const left = (rect.left - scaleRect.left) / zoom;
                    const right = (rect.right - scaleRect.left) / zoom;
                    const height = rect.height / zoom;
                    const width = rect.width / zoom;
                    newCoords[q.codigo] = { top, bottom, left, right, height, width };
                }
            });
            setCardCoords(newCoords);
        };

        // Run immediately and after a short timeout to let layout settle
        updateCoords();
        const timer = setTimeout(updateCoords, 150);
        window.addEventListener('resize', updateCoords);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', updateCoords);
        };
    }, [cuestionario, activeSectionId, zoom]);
    // Validation logic (DFS Cycle Detection + Orphan Detection) - derived from state
    const errors = useMemo(() => {
        if (!cuestionario) return [];

        const validationErrors = [];
        const allQuestions = [];
        cuestionario.secciones.forEach(sec => {
            if (sec.preguntas) {
                sec.preguntas.forEach(q => allQuestions.push(q));
            }
        });

        if (allQuestions.length === 0) {
            return [];
        }

        // 1. Check duplicate question codes
        const codes = allQuestions.map(q => q.codigo);
        const duplicateCodes = codes.filter((item, index) => codes.indexOf(item) !== index);
        if (duplicateCodes.length > 0) {
            validationErrors.push({
                type: 'error',
                message: language === 'es' 
                    ? `Códigos de pregunta duplicados: ${[...new Set(duplicateCodes)].join(', ')}`
                    : `Duplicate question codes: ${[...new Set(duplicateCodes)].join(', ')}`
            });
        }

        // 2. Build adjacency list for flows
        const adj = {};
        allQuestions.forEach(q => { adj[q.codigo] = []; });
        
        cuestionario.flujos.forEach(f => {
            if (adj[f.codigo_pregunta_origen]) {
                adj[f.codigo_pregunta_origen].push(f.codigo_pregunta_destino);
            }
        });

        // 3. Cycle Detection using DFS (color status: 0=unvisited, 1=visiting, 2=visited)
        const visitedStatus = {};
        allQuestions.forEach(q => { visitedStatus[q.codigo] = 0; });
        let hasCycle = false;
        const cycles = [];

        const dfsCheckCycle = (u, path = []) => {
            visitedStatus[u] = 1;
            path.push(u);

            const neighbors = adj[u] || [];
            for (let v of neighbors) {
                if (visitedStatus[v] === 1) {
                    hasCycle = true;
                    const cyclePath = path.slice(path.indexOf(v));
                    cycles.push(`${cyclePath.join(' -> ')} -> ${v}`);
                } else if (visitedStatus[v] === 0) {
                    dfsCheckCycle(v, [...path]);
                }
            }
            visitedStatus[u] = 2;
        };

        allQuestions.forEach(q => {
            if (visitedStatus[q.codigo] === 0) {
                dfsCheckCycle(q.codigo);
            }
        });

        if (hasCycle) {
            validationErrors.push({
                type: 'error',
                message: language === 'es'
                    ? `¡Bucle/Ciclo infinito detectado: ${cycles.join(', ')}`
                    : `Infinite loop detected: ${cycles.join(', ')}`
            });
        }

        // 4. Reachability / Orphan Detection
        // Assume first question is entry point
        const entryPoint = allQuestions[0].codigo;
        const reached = {};
        allQuestions.forEach(q => { reached[q.codigo] = false; });

        const dfsReach = (u) => {
            reached[u] = true;
            const neighbors = adj[u] || [];
            neighbors.forEach(v => {
                if (!reached[v]) {
                    dfsReach(v);
                }
            });
        };
        dfsReach(entryPoint);

        const orphans = allQuestions.filter(q => !reached[q.codigo]);
        if (orphans.length > 0) {
            validationErrors.push({
                type: 'warning',
                message: language === 'es'
                    ? `Preguntas inalcanzables (huérfanas): ${orphans.map(q => q.codigo).join(', ')}`
                    : `Unreachable (orphan) questions: ${orphans.map(q => q.codigo).join(', ')}`
            });
        }

        // 5. Empty check validations
        allQuestions.forEach(q => {
            if (q.tipo_codigo === 'UNICA' || q.tipo_codigo === 'MULTIPLE') {
                if (!q.opciones || q.opciones.length === 0) {
                    validationErrors.push({
                        type: 'warning',
                        message: language === 'es'
                            ? `La pregunta ${q.codigo} no tiene opciones definidas.`
                            : `Question ${q.codigo} has no options defined.`
                    });
                }
            }
        });

        // 6. Clinical range overlap validation
        if (cuestionario.id_tipo_cuestionario === 2 && cuestionario.resultados_clinicos) {
            const ranges = cuestionario.resultados_clinicos;
            
            // Warnings for ranges without variables
            ranges.forEach(r => {
                if (!r.id_variable_calculada) {
                    validationErrors.push({
                        type: 'warning',
                        message: language === 'es'
                            ? `El rango clínico "${r.nombre_rango}" (${r.valor_minimo}-${r.valor_maximo}) no tiene ninguna variable clínica asociada.`
                            : `Clinical range "${r.nombre_rango}" (${r.valor_minimo}-${r.valor_maximo}) has no clinical variable associated.`
                    });
                }
            });

            // Overlap checks for ranges of the same variable
            for (let i = 0; i < ranges.length; i++) {
                const r1 = ranges[i];
                if (!r1.id_variable_calculada) continue;
                for (let j = i + 1; j < ranges.length; j++) {
                    const r2 = ranges[j];
                    if (r1.id_variable_calculada === r2.id_variable_calculada) {
                        const overlap = (r1.valor_minimo <= r2.valor_maximo && r1.valor_maximo >= r2.valor_minimo);
                        if (overlap) {
                            const variable = cuestionario.variables.find(v => v.id === r1.id_variable_calculada);
                            const varName = variable ? `${variable.nombre} (${variable.codigo})` : 'Desconocida';
                            validationErrors.push({
                                type: 'error',
                                message: language === 'es'
                                    ? `Traslape de rangos clínicos en la variable "${varName}": "${r1.nombre_rango}" (${r1.valor_minimo}-${r1.valor_maximo}) y "${r2.nombre_rango}" (${r2.valor_minimo}-${r2.valor_maximo})`
                                    : `Clinical range overlap in variable "${varName}": "${r1.nombre_rango}" (${r1.valor_minimo}-${r1.valor_maximo}) and "${r2.nombre_rango}" (${r2.valor_minimo}-${r2.valor_maximo})`
                            });
                        }
                    }
                }
            }
        }

        return validationErrors;
    }, [cuestionario, language]);

    // Handle questionnaire property changes
    const updateMeta = (field, value) => {
        if (isReadOnly) return;
        setCuestionario(prev => ({
            ...prev,
            [field]: value
        }));
    };

    // Save click
    const handleSave = async () => {
        if (isReadOnly) return;
        if (errors.some(e => e.type === 'error')) {
            await alert(language === 'es' 
                ? 'Corrija los errores de flujo/bucle antes de guardar' 
                : 'Please fix flow/loop errors before saving');
            return;
        }

        setSaving(true);
        const res = await saveCuestionario(cuestionario);
        setSaving(false);

        if (res.success) {
            await alert(language === 'es' ? '¡Guardado exitosamente!' : 'Saved successfully!');
            router.push('/admin/dashboard');
        } else {
            await alert(language === 'es' ? 'Error al guardar: ' + res.error : 'Save failed: ' + res.error);
        }
    };

    const handleDeleteCuestionario = async () => {
        const confirmDelete = await confirm(language === 'es' 
            ? '¿Está seguro de eliminar este cuestionario? Esta acción no se puede deshacer.' 
            : 'Are you sure you want to delete this questionnaire? This action cannot be undone.');
        if (!confirmDelete) return;

        const res = await changeEstadoCuestionario(id, 'delete');
        if (res.success) {
            await alert(language === 'es' ? '¡Cuestionario eliminado exitosamente!' : 'Questionnaire deleted successfully!');
            router.push('/admin/dashboard');
        } else {
            await alert(language === 'es' ? 'Error al eliminar: ' + res.error : 'Delete failed: ' + res.error);
        }
    };

    const handleCopy = (id, text) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };


    // ------------------------------------------------------------------------
    // SECTION OPERATIONS
    // ------------------------------------------------------------------------
    const addSection = () => {
        if (isReadOnly) return;
        const newSecId = -(Date.now()); // Temporary negative ID
        const newSec = {
            id: newSecId,
            nombre: `${t('sections')} ${cuestionario.secciones.length + 1}`,
            descripcion: '',
            orden_visual: cuestionario.secciones.length + 1,
            preguntas: [],
            estado: 1
        };
        setCuestionario(prev => ({
            ...prev,
            secciones: [...prev.secciones, newSec]
        }));
        setActiveSectionId(newSecId);
    };

    const updateSection = (secId, field, value) => {
        if (isReadOnly) return;
        setCuestionario(prev => ({
            ...prev,
            secciones: prev.secciones.map(sec => sec.id === secId ? { ...sec, [field]: value } : sec)
        }));
    };

    const deleteSection = async (secId) => {
        if (isReadOnly) return;
        if (cuestionario.secciones.length <= 1) {
            await alert(language === 'es' ? 'Debe tener al menos una sección' : 'You must have at least one section');
            return;
        }
        setCuestionario(prev => {
            const deletedSection = prev.secciones.find(sec => sec.id === secId);
            const deletedCodes = deletedSection && deletedSection.preguntas
                ? deletedSection.preguntas.map(q => q.codigo)
                : [];

            const filteredFlujos = (prev.flujos || []).filter(f => 
                !deletedCodes.includes(f.codigo_pregunta_origen) && 
                !deletedCodes.includes(f.codigo_pregunta_destino)
            );

            const updated = {
                ...prev,
                secciones: prev.secciones.filter(sec => sec.id !== secId),
                flujos: filteredFlujos
            };
            return syncQuestionCodes(updated);
        });
        if (activeSectionId === secId) {
            const remaining = cuestionario.secciones.filter(sec => sec.id !== secId);
            setActiveSectionId(remaining[0].id);
        }
    };

    // ------------------------------------------------------------------------
    // QUESTION OPERATIONS
    // ------------------------------------------------------------------------
    const addQuestion = async (tipoCodigo) => {
        if (isReadOnly) return;
        if (!activeSectionId) {
            await alert(language === 'es' ? 'Cree una sección primero' : 'Create a section first');
            return;
        }

        // Count all questions to generate code
        let qCount = 0;
        cuestionario.secciones.forEach(sec => { qCount += sec.preguntas ? sec.preguntas.length : 0; });
        const codeNum = qCount + 1;
        const newQId = -(Date.now() + 1);

        const newQ = {
            id: newQId,
            id_tipo_pregunta: tipoCodigo === 'UNICA' ? 1 : tipoCodigo === 'MULTIPLE' ? 2 : tipoCodigo === 'ABIERTA' ? 3 : 4,
            tipo_codigo: tipoCodigo,
            codigo: `P${codeNum}`,
            texto_pregunta: `Pregunta ${codeNum}`,
            orden_visual: 1, // Will compute properly
            obligatoria: 0,
            valor_pregunta: 0,
            permite_otro: 0,
            opciones: [],
            asociaciones: [],
            estado: 1
        };

        setCuestionario(prev => {
            const updated = {
                ...prev,
                secciones: prev.secciones.map(sec => {
                    if (sec.id === activeSectionId) {
                        const pregs = sec.preguntas || [];
                        newQ.orden_visual = pregs.length + 1;
                        return { ...sec, preguntas: [...pregs, newQ] };
                    }
                    return sec;
                })
            };
            return syncQuestionCodes(updated);
        });
        setSelectedQuestionId(newQId);
    };

    // Fetch the active selected question object
    const getSelectedQuestion = () => {
        if (!selectedQuestionId) return null;
        let found = null;
        cuestionario.secciones.forEach(sec => {
            if (sec.preguntas) {
                const q = sec.preguntas.find(curr => curr.id === selectedQuestionId);
                if (q) found = q;
            }
        });
        return found;
    };

    const updateQuestion = (qId, field, value) => {
        if (isReadOnly) return;
        setCuestionario(prev => ({
            ...prev,
            secciones: prev.secciones.map(sec => {
                const pregs = sec.preguntas || [];
                return {
                    ...sec,
                    preguntas: pregs.map(q => q.id === qId ? { ...q, [field]: value } : q)
                };
            })
        }));
    };

    const deleteQuestion = (qId) => {
        if (isReadOnly) return;
        setCuestionario(prev => {
            // Find the question to get its code
            let qCode = null;
            prev.secciones.forEach(sec => {
                const found = (sec.preguntas || []).find(curr => curr.id === qId);
                if (found) qCode = found.codigo;
            });

            // Filter flows related to this question code
            const filteredFlujos = qCode 
                ? (prev.flujos || []).filter(f => f.codigo_pregunta_origen !== qCode && f.codigo_pregunta_destino !== qCode)
                : (prev.flujos || []);

            const updated = {
                ...prev,
                flujos: filteredFlujos,
                secciones: prev.secciones.map(sec => {
                    const pregs = sec.preguntas || [];
                    return {
                        ...sec,
                        preguntas: pregs.filter(curr => curr.id !== qId)
                    };
                })
            };

            return syncQuestionCodes(updated);
        });
        setSelectedQuestionId(null);
    };

    // ------------------------------------------------------------------------
    // DRAG & DROP REORDER
    // ------------------------------------------------------------------------
    const reorderQuestion = (secId, fromIdx, toIdx) => {
        if (isReadOnly) return;
        if (fromIdx === toIdx) return;
        setCuestionario(prev => {
            const updated = {
                ...prev,
                secciones: prev.secciones.map(sec => {
                    if (sec.id !== secId) return sec;
                    const pregs = [...(sec.preguntas || [])];
                    const [moved] = pregs.splice(fromIdx, 1);
                    pregs.splice(toIdx, 0, moved);
                    // Update orden_visual to reflect new positions
                    const updated = pregs.map((q, i) => ({ ...q, orden_visual: i + 1 }));
                    return { ...sec, preguntas: updated };
                })
            };
            return syncQuestionCodes(updated);
        });
    };

    const handleDragStart = (e, idx) => {
        if (isReadOnly) {
            e.preventDefault();
            return;
        }
        dragSrcIdxRef.current = idx;
        e.dataTransfer.effectAllowed = 'move';
        // Ghost image: use the element itself
        e.dataTransfer.setDragImage(e.currentTarget.parentElement, 24, 24);
    };

    const handleDragOver = (e, idx) => {
        if (isReadOnly) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setDragOverIdx(idx);
    };

    const handleDrop = (e, toIdx, secId) => {
        if (isReadOnly) return;
        e.preventDefault();
        const fromIdx = dragSrcIdxRef.current;
        if (fromIdx !== null && fromIdx !== toIdx) {
            reorderQuestion(secId, fromIdx, toIdx);
        }
        dragSrcIdxRef.current = null;
        setDragOverIdx(null);
    };

    const handleDragEnd = () => {
        dragSrcIdxRef.current = null;
        setDragOverIdx(null);
    };

    // ------------------------------------------------------------------------
    // OPTIONS & ASSOCIATIONS
    // ------------------------------------------------------------------------
    const addOption = (qId) => {
        if (isReadOnly) return;
        const q = getSelectedQuestion();
        if (!q) return;
        const opCount = q.opciones ? q.opciones.length : 0;
        const newOp = {
            id: -(Date.now() + opCount),
            texto_opcion: `Opción ${opCount + 1}`,
            codigo_opcion: `OP${opCount + 1}`,
            orden_visual: opCount + 1,
            valor_opcion: 0,
            estado: 1
        };
        updateQuestion(qId, 'opciones', [...(q.opciones || []), newOp]);
    };

    const updateOption = (qId, opId, field, value) => {
        if (isReadOnly) return;
        const q = getSelectedQuestion();
        if (!q) return;
        updateQuestion(qId, 'opciones', q.opciones.map(op => op.id === opId ? { ...op, [field]: value } : op));
    };

    const deleteOption = (qId, opId) => {
        if (isReadOnly) return;
        const q = getSelectedQuestion();
        if (!q) return;
        updateQuestion(qId, 'opciones', q.opciones.filter(op => op.id !== opId));
    };

    const addAsociation = (qId) => {
        if (isReadOnly) return;
        const q = getSelectedQuestion();
        if (!q) return;
        const aCount = q.asociaciones ? q.asociaciones.length : 0;
        const newAssoc = {
            id: -(Date.now() + aCount),
            item_izquierdo: `Elemento A${aCount + 1}`,
            item_derecho: `Elemento B${aCount + 1}`,
            valor_correcto: 0,
            estado: 1
        };
        updateQuestion(qId, 'asociaciones', [...(q.asociaciones || []), newAssoc]);
    };

    const updateAsociation = (qId, assocId, field, value) => {
        if (isReadOnly) return;
        const q = getSelectedQuestion();
        if (!q) return;
        updateQuestion(qId, 'asociaciones', q.asociaciones.map(a => a.id === assocId ? { ...a, [field]: value } : a));
    };

    const deleteAsociation = (qId, assocId) => {
        if (isReadOnly) return;
        const q = getSelectedQuestion();
        if (!q) return;
        updateQuestion(qId, 'asociaciones', q.asociaciones.filter(a => a.id !== assocId));
    };

    // ------------------------------------------------------------------------
    // LOGICAL FLOWS & RULES
    // ------------------------------------------------------------------------
    const addLogicalFlow = (qCode) => {
        if (isReadOnly) return;
        const newFlow = {
            id: -(Date.now()),
            codigo_pregunta_origen: qCode,
            codigo_opcion_respuesta: null,
            operador_codigo: null,
            valor_comparacion: '',
            codigo_pregunta_destino: '',
            prioridad: cuestionario.flujos.length + 1,
            reglas: [],
            estado: 1
        };
        setCuestionario(prev => ({
            ...prev,
            flujos: [...prev.flujos, newFlow]
        }));
    };

    const updateLogicalFlow = (flowId, field, value) => {
        if (isReadOnly) return;
        setCuestionario(prev => ({
            ...prev,
            flujos: prev.flujos.map(f => f.id === flowId ? { ...f, [field]: value } : f)
        }));
    };

    const deleteLogicalFlow = (flowId) => {
        if (isReadOnly) return;
        setCuestionario(prev => ({
            ...prev,
            flujos: prev.flujos.filter(f => f.id !== flowId)
        }));
    };

    // ------------------------------------------------------------------------
    // RESULTS CLASSIFICATIONS
    // ------------------------------------------------------------------------
    const addResultClassification = () => {
        if (isReadOnly) return;
        const newRes = {
            id: -(Date.now()),
            puntaje_desde: 0,
            puntaje_hasta: 10,
            nombre_resultado: language === 'es' ? 'Resultado' : 'Result',
            descripcion: '',
            color: 'green',
            estado: 1
        };
        setCuestionario(prev => ({
            ...prev,
            resultados: [...prev.resultados, newRes]
        }));
    };

    const updateResultClassification = (resId, field, value) => {
        if (isReadOnly) return;
        setCuestionario(prev => ({
            ...prev,
            resultados: prev.resultados.map(r => r.id === resId ? { ...r, [field]: value } : r)
        }));
    };

    const deleteResultClassification = (resId) => {
        if (isReadOnly) return;
        setCuestionario(prev => ({
            ...prev,
            resultados: prev.resultados.filter(r => r.id !== resId)
        }));
    };

    // ------------------------------------------------------------------------
    // CLINICAL CALCULATED VARIABLES
    // ------------------------------------------------------------------------
    const addClinicalVariable = () => {
        if (isReadOnly) return;
        const newVar = {
            id: -(Date.now()),
            codigo: `VAR_${(cuestionario.variables || []).length + 1}`,
            nombre: language === 'es' ? 'Nueva Variable' : 'New Variable',
            descripcion: '',
            formula_calculo: 'SUM',
            valor_minimo: 0,
            valor_maximo: 100,
            unidad_medida: 'pts',
            orden_visual: (cuestionario.variables || []).length + 1,
            preguntas_asociadas: [],
            estado: 1
        };
        setCuestionario(prev => ({
            ...prev,
            variables: [...(prev.variables || []), newVar]
        }));
    };

    const updateClinicalVariable = (varId, field, value) => {
        if (isReadOnly) return;
        setCuestionario(prev => ({
            ...prev,
            variables: (prev.variables || []).map(v => v.id === varId ? { ...v, [field]: value } : v)
        }));
    };

    const deleteClinicalVariable = (varId) => {
        if (isReadOnly) return;
        setCuestionario(prev => ({
            ...prev,
            variables: (prev.variables || []).filter(v => v.id !== varId)
        }));
    };

    const addClinicalVariableQuestion = (varId) => {
        if (isReadOnly) return;
        const targetVar = (cuestionario.variables || []).find(v => v.id === varId);
        if (!targetVar) return;
        
        const currentAssoc = targetVar.preguntas_asociadas || [];
        const newAssoc = {
            id: -(Date.now() + currentAssoc.length),
            id_pregunta: '',
            peso: 1,
            orden_visual: currentAssoc.length + 1,
            estado: 1
        };

        updateClinicalVariable(varId, 'preguntas_asociadas', [...currentAssoc, newAssoc]);
    };

    const updateClinicalVariableQuestion = (varId, assocId, field, value) => {
        if (isReadOnly) return;
        const targetVar = (cuestionario.variables || []).find(v => v.id === varId);
        if (!targetVar) return;

        const updatedAssocs = (targetVar.preguntas_asociadas || []).map(a => 
            a.id === assocId ? { ...a, [field]: value } : a
        );

        updateClinicalVariable(varId, 'preguntas_asociadas', updatedAssocs);
    };

    const deleteClinicalVariableQuestion = (varId, assocId) => {
        if (isReadOnly) return;
        const targetVar = (cuestionario.variables || []).find(v => v.id === varId);
        if (!targetVar) return;

        const updatedAssocs = (targetVar.preguntas_asociadas || []).filter(a => a.id !== assocId);

        updateClinicalVariable(varId, 'preguntas_asociadas', updatedAssocs);
    };

    // ------------------------------------------------------------------------
    // CLINICAL RESULTS INTERPRETATION RANGOS
    // ------------------------------------------------------------------------
    const addClinicalRange = () => {
        if (isReadOnly) return;
        const newRange = {
            id: -(Date.now()),
            nombre_rango: language === 'es' ? 'Rango' : 'Range',
            descripcion: '',
            valor_minimo: 0,
            valor_maximo: 10,
            clasificacion: language === 'es' ? 'Clasificación' : 'Classification',
            color_visual: 'green',
            orden_visual: (cuestionario.resultados_clinicos || []).length + 1,
            estado: 1
        };
        setCuestionario(prev => ({
            ...prev,
            resultados_clinicos: [...(prev.resultados_clinicos || []), newRange]
        }));
    };

    const updateClinicalRange = (rangeId, field, value) => {
        if (isReadOnly) return;
        setCuestionario(prev => ({
            ...prev,
            resultados_clinicos: (prev.resultados_clinicos || []).map(r => r.id === rangeId ? { ...r, [field]: value } : r)
        }));
    };

    const deleteClinicalRange = (rangeId) => {
        if (isReadOnly) return;
        setCuestionario(prev => ({
            ...prev,
            resultados_clinicos: (prev.resultados_clinicos || []).filter(r => r.id !== rangeId)
        }));
    };

    const handleExportUserGuideHTML = () => {
        const isEs = language === 'es';
        const title = isEs ? 'Guía del Usuario - Constructor de Cuestionarios' : 'User Guide - Questionnaire Builder';
        
        const htmlContent = `<!DOCTYPE html>
<html lang="${language}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>\${title}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #071724;
            --card-bg: rgba(13, 33, 49, 0.7);
            --border-color: rgba(6, 182, 212, 0.2);
            --text-color: #fafafa;
            --text-muted: #94a3b8;
            --accent-cyan: #06b6d4;
            --accent-orange: #ff7a39;
            --accent-green: #01ae6c;
            --accent-yellow: #eab308;
            --shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
        }
        body {
            font-family: 'Outfit', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-color);
            margin: 0;
            padding: 2rem;
            line-height: 1.6;
        }
        .container {
            max-width: 900px;
            margin: 0 auto;
        }
        .header {
            text-align: center;
            margin-bottom: 3rem;
            padding-bottom: 1.5rem;
            border-bottom: 1px solid var(--border-color);
        }
        .header h1 {
            font-size: 2.2rem;
            font-weight: 800;
            margin: 0;
            background: linear-gradient(135deg, var(--accent-cyan) 0%, var(--accent-orange) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .header p {
            color: var(--text-muted);
            margin-top: 0.5rem;
        }
        .section-title {
            font-size: 1.5rem;
            font-weight: 600;
            margin-top: 2.5rem;
            margin-bottom: 1rem;
            display: flex;
            align-items: center;
            gap: 0.75rem;
            border-bottom: 1px solid rgba(255,255,255,0.08);
            padding-bottom: 0.5rem;
        }
        .card {
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            padding: 1.5rem;
            margin-bottom: 1.5rem;
            box-shadow: var(--shadow);
            backdrop-filter: blur(12px);
        }
        .card h3 {
            font-size: 1.1rem;
            margin-top: 0;
            margin-bottom: 0.75rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        .card p {
            font-size: 0.9rem;
            color: var(--text-color);
            margin-bottom: 1rem;
        }
        .info-box {
            background: rgba(7, 23, 36, 0.9);
            border: 1px solid rgba(6, 182, 212, 0.1);
            border-radius: 10px;
            padding: 1rem;
            font-size: 0.85rem;
            margin-top: 1rem;
        }
        .info-box div {
            margin-bottom: 0.5rem;
        }
        .info-box div:last-child {
            margin-bottom: 0;
        }
        .badge {
            font-weight: bold;
            color: var(--accent-orange);
        }
        ul {
            padding-left: 1.25rem;
            margin: 0;
        }
        li {
            font-size: 0.85rem;
            margin-bottom: 0.5rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>\${title}</h1>
            <p>\${isEs ? 'Documentación y Guía de Ayuda para el Administrador' : 'Documentation and Help Guide for the Administrator'}</p>
        </div>

        <h2 class="section-title"><span style="color: var(--accent-cyan)">🗂️</span> \${isEs ? 'Secciones y Tipos de Pregunta' : 'Sections & Question Types'}</h2>
        
        <div class="card">
            <h3><span style="color: var(--accent-cyan)">📁</span> \${isEs ? 'Secciones' : 'Sections'}</h3>
            <p>\${isEs ? 'Permiten agrupar preguntas en páginas o pasos independientes. Al responder el cuestionario, cada sección representa una pantalla separada.' : 'Allow grouping questions into pages or independent steps. When responding to the questionnaire, each section represents a separate screen.'}</p>
            <div class="info-box">
                <div><span class="badge">\${isEs ? 'Cómo se usa:' : 'How to use:'}</span> \${isEs ? 'Haz clic en "➕" junto a Secciones en el panel izquierdo. Para editar el nombre y descripción, selecciónala y edítala en la parte superior del canvas central.' : 'Click "➕" next to Sections in the left panel. To edit the name and description, select it and modify it at the top of the center canvas.'}</div>
                <div><span class="badge">\${isEs ? 'Ejemplo:' : 'Example:'}</span> \${isEs ? 'Sección 1: "Datos Demográficos"; Sección 2: "Síntomas Principales"; Sección 3: "Evaluación de Riesgo".' : 'Section 1: "Demographics"; Section 2: "Key Symptoms"; Section 3: "Risk Assessment".'}</div>
            </div>
        </div>

        <div class="card">
            <h3><span style="color: var(--accent-cyan)">●</span> \${isEs ? 'Selección Única' : 'Single Choice'}</h3>
            <p>\${isEs ? 'El usuario solo puede marcar una única opción de la lista. Útil para preguntas de tipo Sí/No o escalas cerradas. Cada opción puede sumar puntos.' : 'The user can only select a single option from the list. Useful for Yes/No questions or closed scales. Each option can award points.'}</p>
            <div class="info-box">
                <div><span class="badge">\${isEs ? 'Cómo se usa:' : 'How to use:'}</span> \${isEs ? 'Agrega la pregunta desde la biblioteca. En el panel derecho de propiedades, haz clic en "➕" en Opciones. Escribe el código (ej. OP1), los puntos y el texto.' : 'Add the question from the library. In the right properties panel, click "➕" under Options. Write the code (e.g. OP1), points, and option text.'}</div>
                <div><span class="badge">\${isEs ? 'Ejemplo:' : 'Example:'}</span> \${isEs ? '"¿Fuma actualmente?" -> Sí (5 pts), No (0 pts).' : '"Do you currently smoke?" -> Yes (5 pts), No (0 pts).'}</div>
            </div>
        </div>

        <div class="card">
            <h3><span style="color: var(--accent-green)">☑️</span> \${isEs ? 'Selección Múltiple' : 'Multiple Choice'}</h3>
            <p>\${isEs ? 'Permite al encuestado seleccionar múltiples opciones simultáneamente. Cada opción seleccionada acumula puntos al total.' : 'Allows the respondent to select multiple options simultaneously. Each checked option accumulates points toward the total score.'}</p>
            <div class="info-box">
                <div><span class="badge">\${isEs ? 'Cómo se usa:' : 'How to use:'}</span> \${isEs ? 'Se configura igual que Selección Única en el panel derecho. El usuario final verá casillas de verificación (checkboxes).' : 'Configured the same as Single Choice in the right panel. The respondent will see checkboxes.'}</div>
                <div><span class="badge">\${isEs ? 'Ejemplo:' : 'Example:'}</span> \${isEs ? '"Marque los síntomas que presenta:" -> Tos (1 pt), Fiebre (2 pts), Dificultad para respirar (5 pts). Si marca los tres, suma 8 puntos.' : '"Select the symptoms you present:" -> Cough (1 pt), Fever (2 pts), Shortness of breath (5 pts). If they select all three, they get 8 points.'}</div>
            </div>
        </div>

        <div class="card">
            <h3><span style="color: var(--accent-orange)">✏️</span> \${isEs ? 'Pregunta Abierta' : 'Open Text'}</h3>
            <p>\${isEs ? 'Campo de texto libre para explicaciones o diagnósticos. No otorga puntos al score total.' : 'Free text field for explanations, feedback, or diagnostics. Does not award points to the total score.'}</p>
            <div class="info-box">
                <div><span class="badge">\${isEs ? 'Cómo se usa:' : 'How to use:'}</span> \${isEs ? 'Añádela desde la biblioteca de preguntas. Úsala cuando no existan opciones de respuesta predefinidas.' : 'Add it from the question library. Use it when there are no predefined response choices.'}</div>
                <div><span class="badge">\${isEs ? 'Ejemplo:' : 'Example:'}</span> \${isEs ? '"Describa detalladamente los antecedentes familiares de diabetes".' : '"Describe in detail any family history of diabetes".'}</div>
            </div>
        </div>

        <div class="card">
            <h3><span style="color: var(--accent-yellow)">⇄</span> \${isEs ? 'Pregunta Asociativa' : 'Matching'}</h3>
            <p>\${isEs ? 'Pregunta de emparejamiento. El usuario debe relacionar un elemento de la izquierda con el correspondiente correcto a la derecha.' : 'Matching question. The user must match a concept on the left with the correct equivalent on the right.'}</p>
            <div class="info-box">
                <div><span class="badge">\${isEs ? 'Cómo se usa:' : 'How to use:'}</span> \${isEs ? 'Agrega la pregunta. En el panel derecho, haz clic en "➕" en Correspondencias. Define el Elemento Izquierdo, el Elemento Derecho correcto y los puntos por emparejamiento exitoso.' : 'Add the question. In the right panel, click "➕" under Matching Pairs. Define the Left Element, the correct Right Element, and the points awarded for a successful match.'}</div>
                <div><span class="badge">\${isEs ? 'Ejemplo:' : 'Example:'}</span> \${isEs ? 'Columna Izquierda: "Hipertensión" ⇄ Columna Derecha: "Cardiología" (5 pts).' : 'Left Column: "Hypertension" ⇄ Right Column: "Cardiology" (5 pts).'}</div>
            </div>
        </div>

        <h2 class="section-title"><span style="color: var(--accent-orange)">🔀</span> \${isEs ? 'Flujos Lógicos y Reglas Condicionales' : 'Logical Flows & Conditional Rules'}</h2>
        
        <div class="card">
            <h3><span style="color: var(--accent-orange)">🔀</span> \${isEs ? 'Navegación Dinámica' : 'Dynamic Navigation'}</h3>
            <p>\${isEs ? 'Permiten saltar preguntas o secciones completas basándose en lo que responde el usuario, en lugar de seguir un cuestionario rígido de arriba a abajo.' : 'Allow jumping questions or entire sections based on what the user responds, instead of following a rigid top-to-bottom order.'}</p>
            <div class="info-box">
                <div><span class="badge">\${isEs ? 'Cómo se usa:' : 'How to use:'}</span> \${isEs ? 'Selecciona una pregunta (de Selección Única o Múltiple). En el panel derecho de propiedades, ve a Flujos Lógicos, presiona "➕", elige la opción de disparo y el código de la pregunta destino.' : 'Select a question (Single or Multiple Choice). In the right properties panel, go to Logical Flows, click "➕", select the triggering option and the target question code.'}</div>
                <div><span class="badge">\${isEs ? 'Ejemplo:' : 'Example:'}</span> \${isEs ? 'En la pregunta P1 (¿Tiene dolor abdominal?), si responde "No" (OP2), se agrega una regla para saltar a P3 (¿Tiene dolor de cabeza?). Así se omite P2 (¿En qué parte del abdomen?), la cual ya no es relevante.' : 'In question P1 (Do you have abdominal pain?), if they answer "No" (OP2), add a rule to jump to P3 (Do you have a headache?). This skips P2 (Where in the abdomen is the pain?), which is no longer relevant.'}</div>
            </div>
        </div>

        <div class="card">
            <h3><span style="color: var(--accent-yellow)">⚠️</span> \${isEs ? 'Validación de Consistencia' : 'Consistency Validation'}</h3>
            <p>\${isEs ? 'El constructor valida tu cuestionario en tiempo real para evitar errores que bloqueen al usuario final:' : 'The builder validates your questionnaire in real-time to prevent errors that block the end user:'}</p>
            <ul>
                <li><strong>\${isEs ? 'Ciclo / Bucle Infinito:' : 'Infinite Loop:'}</strong> \${isEs ? 'Ocurre cuando la navegación regresa cíclicamente a un punto anterior sin salida (ej. P1 -> P2 -> P1). El constructor impide guardar el cuestionario si existen bucles activos.' : 'Occurs when navigation cycles back to a previous point without an exit path (e.g. P1 -> P2 -> P1). The builder prevents saving if there are active loops.'}</li>
                <li><strong>\${isEs ? 'Preguntas Huérfanas:' : 'Orphan Questions:'}</strong> \${isEs ? 'Preguntas que han quedado inalcanzables debido a que ningún flujo condicional ni la navegación natural del cuestionario lleva a ellas. Se muestra como una advertencia.' : 'Questions that have become unreachable because no logic flow or natural order leads to them. Displayed as a warning.'}</li>
            </ul>
        </div>

        <h2 class="section-title"><span style="color: var(--accent-green)">📊</span> \${isEs ? 'Resultados y Clasificaciones' : 'Results & Classifications'}</h2>
        
        <div class="card">
            <h3><span style="color: var(--accent-green)">📊</span> \${isEs ? 'Clasificación por Puntaje' : 'Score Classifications'}</h3>
            <p>\${isEs ? 'Define la evaluación final que se presentará al encuestado cuando complete el cuestionario, sumando los puntos acumulados por sus respuestas.' : 'Defines the final evaluation presented to the respondent upon completion, based on the sum of points accumulated from their answers.'}</p>
            <div class="info-box">
                <div><span class="badge">\${isEs ? 'Cómo se usa:' : 'How to use:'}</span> \${isEs ? 'Haz clic en un área vacía del lienzo para deseleccionar cualquier pregunta. En el panel de propiedades derecho, bajo "Resultados", haz clic en "➕ Añadir Rango de Puntaje". Escribe los límites (Ej. Desde 0 Hasta 10), el nombre y el color semántico.' : 'Click an empty area on the canvas to deselect any question. In the right properties panel, under "Results Classifications", click "➕ Add Score Range". Write the limits (e.g. Min 0 Max 10), name, and status color.'}</div>
                <div><span class="badge">\${isEs ? 'Ejemplo:' : 'Example:'}</span></div>
                <ul>
                    <li>\${isEs ? '0 a 10 puntos: "Riesgo Mínimo" (Verde)' : '0 to 10 points: "Minimal Risk" (Green)'}</li>
                    <li>\${isEs ? '11 a 20 puntos: "Riesgo Moderado" (Naranja)' : '11 to 20 points: "Moderate Risk" (Orange)'}</li>
                    <li>\${isEs ? '21 a 35 puntos: "Riesgo Severo" (Rojo)' : '21 to 35 points: "Severe Risk" (Red)'}</li>
                </ul>
            </div>
        </div>

        <h2 class="section-title"><span style="color: var(--accent-cyan)">📋</span> \${isEs ? 'Tipos de Cuestionario y Cálculo' : 'Questionnaire Types & Calculations'}</h2>
        
        <div class="card">
            <h3><span style="color: var(--accent-cyan)">📋</span> \${isEs ? 'Cuestionario General' : 'General Questionnaire'}</h3>
            <p>\${isEs ? 'Cuestionarios lineales con sumatoria acumulativa total de puntos.' : 'Linear questionnaires with a total cumulative point sum.'}</p>
            <div class="info-box">
                <div><span class="badge">\${isEs ? 'Mecanismo de Cálculo:' : 'Calculation Mechanism:'}</span> \${isEs ? 'Suma directa de los puntajes de las opciones marcadas. Se almacena el puntaje total en TKR_CUESTIONARIO_RESPUESTA.' : 'Direct sum of the scores of selected options. The total score is stored in TKR_CUESTIONARIO_RESPUESTA.'}</div>
                <div><span class="badge">\${isEs ? 'Interpretación:' : 'Interpretation:'}</span> \${isEs ? 'El puntaje acumulado total se evalúa contra la tabla de rangos globales (TKR_RANGOS_INTERPRETACION) asociados al cuestionario.' : 'The total accumulated score is evaluated against the table of global ranges (TKR_RANGOS_INTERPRETACION) associated with the questionnaire.'}</div>
            </div>
        </div>

        <div class="card">
            <h3><span style="color: #8b5cf6">🧠</span> \${isEs ? 'Cuestionario Clínico (Salud Mental)' : 'Clinical Questionnaire (Mental Health)'}</h3>
            <p>\${isEs ? 'Diseñados para evaluaciones complejas de múltiples dimensiones clínicas o psiquiátricas en paralelo.' : 'Designed for complex evaluations of multiple clinical or psychiatric dimensions in parallel.'}</p>
            <div class="info-box">
                <div><span class="badge">\${isEs ? 'Dimensiones (Variables):' : 'Dimensions (Variables):'}</span> \${isEs ? 'Agrupan subconjuntos de preguntas específicas (ej. Depresión). Configurable en TKR_VARIABLES_CALCULADAS.' : 'Group specific subsets of questions (e.g., Depression). Configurable in TKR_VARIABLES_CALCULADAS.'}</div>
                <div><span class="badge">\${isEs ? 'Ponderación (Pesos):' : 'Weighting (Weights):'}</span> \${isEs ? 'Cada pregunta dentro de la dimensión posee un coeficiente multiplicador (ej. 1, 1.5, -1 para ítems inversos) definido en TKR_VARIABLES_CALCULADAS_DET.' : 'Each question within the dimension has a multiplier coefficient (e.g., 1, 1.5, -1 for reverse items) defined in TKR_VARIABLES_CALCULADAS_DET.'}</div>
                <div><span class="badge">\${isEs ? 'Rangos Clínicos Independientes:' : 'Independent Clinical Ranges:'}</span> \${isEs ? 'Cada dimensión clínica tiene sus propios límites de puntaje y clasificaciones en TKR_RANGOS_INTERPRETACION (ej. Ansiedad Leve 0-5; Ansiedad Severa 15-20), independientes de las demás dimensiones.' : 'Each clinical dimension has its own score limits and classifications in TKR_RANGOS_INTERPRETACION (e.g., Mild Anxiety 0-5; Severe Anxiety 15-20), independent of other dimensions.'}</div>
            </div>
        </div>

        <h2 class="section-title"><span style="color: var(--accent-cyan)">📄</span> \${isEs ? 'Presentación del Cuestionario' : 'Questionnaire Layout'}</h2>
        
        <div class="card">
            <h3><span style="color: var(--accent-cyan)">📄</span> \${isEs ? 'Pregunta por Pregunta (Secuencial)' : 'Question by Question (Sequential)'}</h3>
            <p>\${isEs ? 'El cuestionario se presenta de forma secuencial: una pregunta (o sección) a la vez. El usuario navega con botones de Anterior y Siguiente. Es ideal para cuestionarios guiados y estructurados.' : 'The questionnaire is presented sequentially: one question (or section) at a time. The user navigates using Previous and Next buttons. It is ideal for guided and structured questionnaires.'}</p>
            <div class="info-box">
                <div><span class="badge">\${isEs ? 'Flujos Lógicos:' : 'Logical Flows:'}</span> \${isEs ? 'Totalmente soportados. Permite realizar saltos condicionales de navegación en tiempo real según las respuestas dadas.' : 'Fully supported. Allows real-time conditional navigation jumps based on the answers given.'}</div>
                <div><span class="badge">\${isEs ? 'Valor en BD:' : 'DB Value:'}</span> PRESENTACION_UNICA = 0 (por defecto)</div>
            </div>
        </div>

        <div class="card">
            <h3><span style="color: var(--accent-green)">📃</span> \${isEs ? 'Una sola Página (Scroll continuo)' : 'Single Page (Continuous scroll)'}</h3>
            <p>\${isEs ? 'Todas las preguntas del cuestionario se muestran simultáneamente en una sola página con desplazamiento vertical (scroll). El usuario puede ver y contestar las preguntas en el orden que desee antes de realizar el envío.' : 'All questions in the questionnaire are displayed simultaneously on a single page with vertical scrolling. The user can view and answer the questions in any order before submitting.'}</p>
            <div class="info-box">
                <div><span class="badge">\${isEs ? 'Flujos Lógicos:' : 'Logical Flows:'}</span> \${isEs ? 'No se aplican. En este modo de scroll continuo, todos los saltos y flujos condicionales quedan inhabilitados.' : 'Not applied. In this continuous scroll mode, all jumps and conditional flows are disabled.'}</div>
                <div><span class="badge">\${isEs ? 'Validación:' : 'Validation:'}</span> \${isEs ? 'Al finalizar, el sistema valida todas las preguntas obligatorias y hace un desplazamiento suave (scroll) automático a la primera pregunta sin responder.' : 'Upon completion, the system validates all required questions and automatically performs a smooth scroll to the first unanswered question.'}</div>
                <div><span class="badge">\${isEs ? 'Valor en BD:' : 'DB Value:'}</span> PRESENTACION_UNICA = 1</div>
            </div>
        </div>
    </div>
</body>
</html>`;

        const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'Guia_Usuario_Cuestionarios.html');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleExportDevHelpHTML = () => {
        const isEs = language === 'es';
        const title = isEs ? 'Documentación Técnica de Base de Datos' : 'Technical Database Documentation';
        
        let proceduresHtml = '';
        Object.keys(plsqlDocs).forEach(key => {
            const doc = plsqlDocs[key];
            
            let paramsTableHtml = '';
            if (doc.params && doc.params.length > 0) {
                const rows = doc.params.map(p => {
                    const reqBadge = p.required 
                        ? `<span class="badge-req req-yes">${isEs ? 'Sí' : 'Yes'}</span>` 
                        : `<span class="badge-req req-no">${isEs ? 'No' : 'No'}</span>`;
                    const desc = isEs ? p.descEs : p.descEn;
                    return `
                    <tr>
                        <td class="param-name">${p.name}</td>
                        <td class="param-type">${p.type}</td>
                        <td>${reqBadge}</td>
                        <td>${desc}</td>
                    </tr>`;
                }).join('');

                paramsTableHtml = `
                <h5>${isEs ? 'Parámetros del JSON de Entrada' : 'Input JSON Parameters'}</h5>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>${isEs ? 'Columna' : 'Column'}</th>
                                <th>${isEs ? 'Tipo' : 'Type'}</th>
                                <th>${isEs ? 'Requerido' : 'Required'}</th>
                                <th>${isEs ? 'Descripción' : 'Description'}</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows}
                        </tbody>
                    </table>
                </div>`;
            } else {
                paramsTableHtml = `<p class="no-params">${isEs ? 'No requiere parámetros en el JSON de entrada.' : 'No parameters required in the input JSON.'}</p>`;
            }

            const highlightCode = (code) => {
                const keywords = ['DECLARE', 'BEGIN', 'END;', 'IN', 'OUT', 'PROCEDURE', 'VARCHAR2', 'NUMBER', 'CLOB', 'NULL', 'IS', 'AS', 'AND', 'OR', 'IF', 'THEN', 'ELSE', 'LOOP', 'COMMIT', 'ROLLBACK', 'SELECT', 'INTO', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'VALUES', 'SET', 'SYSDATE', 'TO_CHAR', 'CASE', 'WHEN', 'EXCEPTION', 'OTHERS'];
                let escaped = code
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;');
                escaped = escaped.replace(/(--.*)/g, '<span class="code-comment">$&</span>');
                escaped = escaped.replace(/('([^'\\]|\\.)*')/g, '<span class="code-string">$&</span>');
                keywords.forEach(kw => {
                    const regex = new RegExp('\\\\b(' + kw + ')\\\\b', 'g');
                    escaped = escaped.replace(regex, '<span class="code-keyword">$1</span>');
                });
                escaped = escaped.replace(/(pkgln_cuestionarios\\.[a-zA-Z0-9_]+)/g, '<span class="code-func">$&</span>');
                escaped = escaped.replace(/(DBMS_OUTPUT\\.[a-zA-Z0-9_]+)/g, '<span class="code-func">$&</span>');
                return escaped;
            };

            proceduresHtml += `
            <div class="card" id="proc-${key}">
                <div class="card-header">
                    <h4>${doc.name}</h4>
                </div>
                <div class="card-body">
                    <p class="desc">${isEs ? doc.descEs : doc.descEn}</p>
                    
                    ${paramsTableHtml}
                    
                    <h5 style="margin-top: 1.5rem;">${isEs ? 'Salida CLOB' : 'CLOB Output'}</h5>
                    <p class="output-desc">${isEs ? doc.outputEs : doc.outputEn}</p>
                    
                    <h5 style="margin-top: 1.5rem;">${isEs ? 'Ejemplo de llamado PL/SQL' : 'PL/SQL Invocation Example'}</h5>
                    <div class="code-block">
                        <div class="code-header">Monaco Editor - PL/SQL</div>
                        <pre><code>${highlightCode(doc.code)}</code></pre>
                    </div>
                </div>
            </div>`;
        });

        const sidebarLinks = Object.keys(plsqlDocs).map(key => {
            return `<a href="#proc-${key}">${key}</a>`;
        }).join('\n');

        const htmlContent = `<!DOCTYPE html>
<html lang="${language}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #0c1a24;
            --card-bg: rgba(18, 38, 54, 0.7);
            --border-color: rgba(6, 182, 212, 0.25);
            --text-color: #fafafa;
            --text-muted: #a4b5c6;
            --accent-cyan: #06b6d4;
            --accent-orange: #ff7a39;
            --accent-green: #01ae6c;
            --code-bg: #1e1e1e;
            --shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.45);
        }
        body {
            font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-color);
            margin: 0;
            padding: 0;
            display: flex;
            height: 100vh;
            overflow: hidden;
        }
        .sidebar {
            width: 280px;
            background: rgba(8, 20, 29, 0.95);
            border-right: 1px solid var(--border-color);
            display: flex;
            flex-direction: column;
            padding: 1.5rem;
            box-sizing: border-box;
            overflow-y: auto;
        }
        .sidebar h2 {
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.15em;
            color: var(--text-muted);
            margin-top: 0;
            margin-bottom: 1.5rem;
        }
        .sidebar a {
            display: block;
            padding: 0.6rem 0.8rem;
            color: var(--text-muted);
            text-decoration: none;
            font-size: 0.75rem;
            font-family: monospace;
            font-weight: bold;
            border-radius: 8px;
            margin-bottom: 0.4rem;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            transition: all 0.2s;
        }
        .sidebar a:hover {
            background: rgba(6, 182, 212, 0.1);
            color: var(--accent-cyan);
        }
        .content {
            flex: 1;
            padding: 2.5rem;
            overflow-y: auto;
            box-sizing: border-box;
        }
        .header {
            margin-bottom: 3rem;
            padding-bottom: 1.5rem;
            border-bottom: 1px solid var(--border-color);
        }
        .header h1 {
            font-size: 2rem;
            font-weight: 800;
            margin: 0;
            background: linear-gradient(135deg, var(--accent-cyan) 0%, var(--accent-orange) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .header p {
            color: var(--text-muted);
            font-size: 0.9rem;
            margin-top: 0.5rem;
        }
        .card {
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            margin-bottom: 2.5rem;
            box-shadow: var(--shadow);
            overflow: hidden;
        }
        .card-header {
            background: rgba(8, 20, 29, 0.4);
            padding: 1rem 1.5rem;
            border-bottom: 1px solid var(--border-color);
        }
        .card-header h4 {
            margin: 0;
            font-family: monospace;
            font-size: 1.1rem;
            color: var(--accent-cyan);
        }
        .card-body {
            padding: 1.5rem;
        }
        p.desc {
            font-size: 0.9rem;
            margin-top: 0;
            margin-bottom: 1.5rem;
            color: var(--text-color);
        }
        p.output-desc {
            font-size: 0.85rem;
            color: var(--text-muted);
            margin-bottom: 1rem;
        }
        h5 {
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: var(--text-muted);
            margin-top: 1rem;
            margin-bottom: 0.5rem;
        }
        .table-container {
            border: 1px solid rgba(6, 182, 212, 0.15);
            border-radius: 12px;
            overflow: hidden;
            background: rgba(8, 20, 29, 0.5);
            margin-bottom: 1.5rem;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.8rem;
        }
        th, td {
            padding: 0.75rem 1rem;
            text-align: left;
        }
        th {
            background: rgba(8, 20, 29, 0.8);
            text-transform: uppercase;
            font-size: 0.7rem;
            letter-spacing: 0.08em;
            color: var(--text-muted);
            border-bottom: 1px solid rgba(6, 182, 212, 0.15);
        }
        td {
            border-bottom: 1px solid rgba(6, 182, 212, 0.08);
        }
        tr:last-child td {
            border-bottom: none;
        }
        .param-name {
            font-family: monospace;
            font-weight: bold;
            color: var(--accent-orange);
        }
        .param-type {
            font-family: monospace;
            color: var(--text-muted);
        }
        .badge-req {
            font-size: 0.65rem;
            font-weight: bold;
            padding: 0.15rem 0.4rem;
            border-radius: 99px;
        }
        .req-yes {
            background: rgba(239, 68, 68, 0.15);
            color: #ef4444;
        }
        .req-no {
            background: rgba(255, 255, 255, 0.08);
            color: var(--text-muted);
        }
        .no-params {
            font-size: 0.8rem;
            color: var(--text-muted);
            font-style: italic;
        }
        .code-block {
            border: 1px solid rgba(6, 182, 212, 0.2);
            border-radius: 12px;
            background: var(--code-bg);
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            overflow: hidden;
            margin-top: 0.5rem;
        }
        .code-header {
            background: #252526;
            padding: 0.5rem 1rem;
            font-family: monospace;
            font-size: 0.65rem;
            text-transform: uppercase;
            color: #858585;
            border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        pre {
            margin: 0;
            padding: 1.2rem;
            overflow-x: auto;
        }
        code {
            font-family: monospace;
            font-size: 0.75rem;
            color: #d4d4d4;
        }
        .code-comment { color: #6a9955; }
        .code-string { color: #ce9178; }
        .code-keyword { color: #569cd6; font-weight: bold; }
        .code-func { color: #dcdcaa; font-weight: bold; }
    </style>
</head>
<body>
    <div class="sidebar">
        <h2>PROCEDIMIENTOS</h2>
        ${sidebarLinks}
    </div>
    <div class="content">
        <div class="header">
            <h1>${title}</h1>
            <p>${isEs ? 'Referencia Completa de la Base de Datos para el Paquete PKGLN_CUESTIONARIOS' : 'Complete Database Reference for PKGLN_CUESTIONARIOS Package'}</p>
        </div>
        ${proceduresHtml}
    </div>
</body>
</html>`;

        const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'Doc_Tecnica_Cuestionarios.html');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading || !cuestionario) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#effaff] dark:bg-[#121212]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#ff7a39]"></div>
            </div>
        );
    }

    const selQuestion = getSelectedQuestion();
    const activeSection = cuestionario.secciones.find(s => s.id === activeSectionId);

    // Helper to get text representation of a flow triggering condition
    const getFlowConditionText = (flow) => {
        if (!flow.codigo_opcion_respuesta) return language === 'es' ? 'Siempre' : 'Always';
        // Look up option text
        let foundQ = null;
        cuestionario.secciones.forEach(sec => {
            (sec.preguntas || []).forEach(q => {
                if (q.codigo === flow.codigo_pregunta_origen) foundQ = q;
            });
        });
        if (foundQ && foundQ.opciones) {
            const opt = foundQ.opciones.find(o => o.codigo_opcion === flow.codigo_opcion_respuesta);
            if (opt) {
                return `${flow.codigo_opcion_respuesta}: ${opt.texto_opcion}`;
            }
        }
        return flow.codigo_opcion_respuesta;
    };

    const renderFlowConnections = () => {
        if (!activeSection || !activeSection.preguntas) return null;
        
        const activeQuestionCodes = activeSection.preguntas.map(q => q.codigo);
        // Find flows where both source and destination questions are in the active section
        const sectionFlows = (cuestionario.flujos || []).filter(f => 
            activeQuestionCodes.includes(f.codigo_pregunta_origen) && 
            activeQuestionCodes.includes(f.codigo_pregunta_destino)
        );

        // Group flows by origin -> destination to calculate offset for parallel lines
        const flowGroups = {};
        sectionFlows.forEach(flow => {
            const key = `${flow.codigo_pregunta_origen}->${flow.codigo_pregunta_destino}`;
            if (!flowGroups[key]) flowGroups[key] = [];
            flowGroups[key].push(flow);
        });

        return Object.keys(flowGroups).flatMap(groupKey => {
            const flows = flowGroups[groupKey];
            const originCode = flows[0].codigo_pregunta_origen;
            const destCode = flows[0].codigo_pregunta_destino;
            
            const src = cardCoords[originCode];
            const dest = cardCoords[destCode];
            
            if (!src || !dest) return [];

            return flows.map((flow, index) => {
                const x1 = src.right;
                const y1 = src.top + src.height / 2;
                
                const x2 = dest.right;
                const y2 = dest.top + dest.height / 2;

                const distance = Math.abs(y2 - y1);
                // The C-curve bows out to the right. dx depends on vertical distance to keep curves proportionate.
                const baseDx = 40 + distance * 0.15;
                const dx = baseDx + index * 25; // apply parallel offset if multiple flows link the same nodes

                const cx1 = x1 + dx;
                const cy1 = y1;
                const cx2 = x2 + dx;
                const cy2 = y2;

                const pathD = `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;

                return (
                    <g key={flow.id}>
                        {/* Interactive/Shadow line to make it visually smooth */}
                        <path 
                            d={pathD} 
                            stroke="rgba(255, 122, 57, 0.12)" 
                            strokeWidth="6" 
                            fill="none" 
                        />
                        {/* Core path line */}
                        <path 
                            d={pathD} 
                            stroke="#ff7a39" 
                            strokeWidth="2" 
                            fill="none" 
                            strokeDasharray={flow.codigo_opcion_respuesta ? "none" : "4,4"}
                            markerEnd="url(#flow-arrow)" 
                        />
                    </g>
                );
            });
        });
    };

    const renderFlowLabels = () => {
        if (!activeSection || !activeSection.preguntas) return null;
        
        const activeQuestionCodes = activeSection.preguntas.map(q => q.codigo);
        const sectionFlows = (cuestionario.flujos || []).filter(f => 
            activeQuestionCodes.includes(f.codigo_pregunta_origen) && 
            activeQuestionCodes.includes(f.codigo_pregunta_destino)
        );

        const flowGroups = {};
        sectionFlows.forEach(flow => {
            const key = `${flow.codigo_pregunta_origen}->${flow.codigo_pregunta_destino}`;
            if (!flowGroups[key]) flowGroups[key] = [];
            flowGroups[key].push(flow);
        });

        return Object.keys(flowGroups).flatMap(groupKey => {
            const flows = flowGroups[groupKey];
            const originCode = flows[0].codigo_pregunta_origen;
            const destCode = flows[0].codigo_pregunta_destino;
            
            const src = cardCoords[originCode];
            const dest = cardCoords[destCode];
            
            if (!src || !dest) return [];

            return flows.map((flow, index) => {
                const x1 = src.right;
                const y1 = src.top + src.height / 2;
                const x2 = dest.right;
                const y2 = dest.top + dest.height / 2;

                const distance = Math.abs(y2 - y1);
                const baseDx = 40 + distance * 0.15;
                const dx = baseDx + index * 25;

                // Bezier midpoint math at t=0.5
                const mx = 0.5 * x1 + 0.5 * x2 + 0.75 * dx;
                const my = 0.5 * y1 + 0.5 * y2;

                const conditionText = getFlowConditionText(flow);

                return (
                    <div 
                        key={`label-${flow.id}`}
                        style={{ left: `${mx}px`, top: `${my}px` }}
                        className="absolute pointer-events-auto z-10 -translate-x-1/2 -translate-y-1/2 bg-slate-900/90 dark:bg-slate-950/90 border border-[#ff7a39]/70 hover:border-[#ff7a39] text-[#ff7a39] dark:text-[#ff925c] px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider shadow-lg shadow-black/40 whitespace-nowrap max-w-[150px] truncate select-none transition-all hover:scale-105 active:scale-95 animate-fade-in"
                        title={conditionText}
                    >
                        {conditionText}
                    </div>
                );
            });
        });
    };

    // List of all questions for targets
    const allQuestionsList = [];
    cuestionario.secciones.forEach(sec => {
        if (sec.preguntas) {
            sec.preguntas.forEach(q => allQuestionsList.push(q));
        }
    });

    return (
        <div className="flex flex-col h-screen text-slate-800 dark:text-[#fafafa] relative overflow-hidden">
            
            {isReadOnly && (
                <div className="mx-4 mt-4 px-6 py-2.5 rounded-xl border border-yellow-500/30 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 text-xs font-bold flex justify-between items-center z-10 shadow-lg backdrop-blur-md">
                    <div className="flex items-center gap-2">
                        <span>🔒</span>
                        <span>
                            {language === 'es' 
                                ? 'Cuestionario Publicado (Modo Lectura). Para editarlo, por favor cámbielo a borrador en el Dashboard.' 
                                : 'Published Questionnaire (Read-Only Mode). To edit it, please switch it to draft in the Dashboard.'}
                        </span>
                    </div>
                </div>
            )}

            {/* Top Editor Bar */}
            <header className="glass-panel mx-4 mt-4 px-6 py-3 flex flex-wrap justify-between items-center z-10 border-[#b6ecff] dark:border-[#262626]">
                <div className="flex items-center gap-3 flex-1 min-w-0 mr-4">
                    <button 
                        onClick={() => router.push('/admin/dashboard')}
                        className="p-2 rounded-lg border border-[#b6ecff] dark:border-[#262626] text-xs font-bold hover:border-[#ff7a39] hover:bg-[#ff7a39]/10 text-slate-700 dark:text-slate-200 hover:text-[#ff7a39] dark:hover:text-[#ff7a39] transition-all"
                    >
                        ⬅️
                    </button>
                    <div className="flex-1 min-w-0 flex flex-col md:flex-row md:items-center gap-2">
                        <div className="flex-1 min-w-0">
                            <input
                                type="text"
                                value={cuestionario.nombre || ''}
                                onChange={(e) => updateMeta('nombre', e.target.value)}
                                disabled={isReadOnly}
                                className="bg-transparent border-none outline-none font-bold text-slate-800 dark:text-[#fafafa] text-lg w-full focus:ring-1 focus:ring-[#00aae1] rounded px-1.5"
                                placeholder={language === 'es' ? 'Nombre del cuestionario' : 'Questionnaire name'}
                            />
                            <div className="flex items-center gap-3 text-xs text-slate-400 font-semibold uppercase px-1.5">
                                <span>{t('version')}: {cuestionario.version}</span>
                                <span>•</span>
                                <span>{cuestionario.id_tipo_cuestionario === 2 ? (language === 'es' ? 'Salud Mental' : 'Mental Health') : (language === 'es' ? 'General' : 'General')}</span>
                            </div>
                        </div>
                        <div className="shrink-0 flex items-center gap-1.5 text-xs mr-4">
                            <label className="text-slate-505 dark:text-slate-400 font-semibold">{language === 'es' ? 'Tipo:' : 'Type:'}</label>
                            <select
                                value={cuestionario.id_tipo_cuestionario || 1}
                                onChange={(e) => updateMeta('id_tipo_cuestionario', parseInt(e.target.value))}
                                disabled={isReadOnly}
                                className="bg-white/40 dark:bg-black/20 border border-[#b6ecff] dark:border-[#262626] rounded px-2.5 py-1 text-[#04354d] dark:text-[#fafafa] focus:outline-none focus:border-[#00aae1] font-bold text-xs"
                            >
                                <option value={1} className="bg-slate-100 dark:bg-[#0c1a24] text-slate-850 dark:text-[#fafafa]">{language === 'es' ? 'General' : 'General'}</option>
                                <option value={2} className="bg-slate-100 dark:bg-[#0c1a24] text-slate-850 dark:text-[#fafafa]">{language === 'es' ? 'Salud Mental (Clínico)' : 'Mental Health (Clinical)'}</option>
                            </select>
                        </div>
                        <div className="shrink-0 flex items-center gap-1.5 text-xs mr-4">
                            <label className="text-slate-505 dark:text-slate-400 font-semibold">{language === 'es' ? 'Presentación:' : 'Layout:'}</label>
                            <select
                                value={cuestionario.presentacion_unica || 0}
                                onChange={(e) => updateMeta('presentacion_unica', parseInt(e.target.value))}
                                disabled={isReadOnly}
                                className="bg-white/40 dark:bg-black/20 border border-[#b6ecff] dark:border-[#262626] rounded px-2.5 py-1 text-[#04354d] dark:text-[#fafafa] focus:outline-none focus:border-[#00aae1] font-bold text-xs"
                            >
                                <option value={0} className="bg-slate-100 dark:bg-[#0c1a24] text-slate-850 dark:text-[#fafafa]">{language === 'es' ? 'Pregunta por Pregunta' : 'Question by Question'}</option>
                                <option value={1} className="bg-slate-100 dark:bg-[#0c1a24] text-slate-850 dark:text-[#fafafa]">{language === 'es' ? 'Una sola Página' : 'Single Page'}</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handleDeleteCuestionario}
                        className="px-3 py-1.5 rounded-lg border border-red-500/30 hover:border-red-500 hover:bg-red-500/10 text-xs font-semibold text-red-600 dark:text-red-400 hover:text-red-500 transition-all flex items-center gap-1.5 bg-white/5"
                        title={language === 'es' ? 'Eliminar Cuestionario' : 'Delete Questionnaire'}
                    >
                        🗑️ {language === 'es' ? 'Eliminar' : 'Delete'}
                    </button>

                    <button
                        onClick={() => {
                            setActiveHelpTab('secciones');
                            setShowHelpModal(true);
                        }}
                        className="px-3 py-1.5 rounded-lg border border-[#b6ecff] dark:border-[#262626] text-xs font-semibold hover:border-[#ff7a39] hover:bg-[#ff7a39]/10 flex items-center gap-1.5 bg-white/5 text-slate-700 dark:text-slate-200 hover:text-[#ff7a39] dark:hover:text-[#ff7a39] transition-all"
                        title={language === 'es' ? 'Ver Guía de Uso' : 'View User Guide'}
                    >
                        ❓ {language === 'es' ? 'Ayuda' : 'Help'}
                    </button>

                    <button
                        onClick={toggleTheme}
                        className="px-3 py-1.5 rounded-lg border border-[#b6ecff] dark:border-[#262626] text-xs font-semibold hover:border-[#ff7a39] hover:bg-[#ff7a39]/10 text-slate-700 dark:text-slate-200 hover:text-[#ff7a39] dark:hover:text-[#ff7a39] transition-all"
                    >
                        {theme === 'light' ? '🌙' : '☀️'}
                    </button>

                    <button
                        onClick={handleSave}
                        disabled={saving || isReadOnly}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#ff7a39] to-[#ff5a1f] hover:from-[#e06020] hover:to-[#e04a14] text-slate-50 font-bold text-xs uppercase tracking-wider shadow-md transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                        {saving ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                            t('save')
                        )}
                    </button>
                </div>
            </header>

            {/* Validation floating bar */}
            {errors.length > 0 && (
                <div className="absolute bottom-4 left-4 z-20 w-80 glass-panel p-4 border-red-500/20 max-h-48 overflow-y-auto">
                    <div className="text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        ⚠️ {language === 'es' ? 'Validación de Flujo' : 'Flow Validation'}
                    </div>
                    <div className="space-y-1.5">
                        {errors.map((err, idx) => (
                            <div 
                                key={idx} 
                                className={`text-[10px] p-1.5 rounded-lg font-medium leading-relaxed ${
                                    err.type === 'error' 
                                        ? 'bg-red-500/10 border border-red-500/20 text-red-500' 
                                        : 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-500'
                                }`}
                            >
                                {err.message}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Main Panel layout */}
            <div className="flex-1 flex overflow-hidden p-4 gap-4 h-full">
                
                {/* 1. Left Panel: Library and Sections List */}
                <div className="w-64 glass-panel border-[#b6ecff] dark:border-[#262626] p-4 flex flex-col gap-6 overflow-y-auto">
                    
                    {/* library */}
                    <div>
                        <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-600 dark:text-slate-400 mb-3">{t('library')}</h3>
                        <div className="grid grid-cols-1 gap-2">
                            <button
                                onClick={() => addQuestion('UNICA')}
                                disabled={isReadOnly}
                                className="w-full p-3 bg-white/40 dark:bg-black/10 border border-[#b6ecff] dark:border-[#262626] rounded-xl hover:border-[#00aae1] text-left text-xs font-semibold flex items-center gap-2 hover:bg-slate-200/10 text-slate-700 dark:text-slate-200 hover:text-[#00aae1] dark:hover:text-[#06b6d4] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <span className="text-[#00aae1]">●</span> {language === 'es' ? 'Selección Única' : 'Single Choice'}
                            </button>
                            <button
                                onClick={() => addQuestion('MULTIPLE')}
                                disabled={isReadOnly}
                                className="w-full p-3 bg-white/40 dark:bg-black/10 border border-[#b6ecff] dark:border-[#262626] rounded-xl hover:border-[#01ae6c] text-left text-xs font-semibold flex items-center gap-2 hover:bg-slate-200/10 text-slate-700 dark:text-slate-200 hover:text-[#01ae6c] dark:hover:text-[#0fecaa] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <span className="text-[#01ae6c]">☑️</span> {language === 'es' ? 'Selección Múltiple' : 'Multiple Choice'}
                            </button>
                            <button
                                onClick={() => addQuestion('ABIERTA')}
                                disabled={isReadOnly}
                                className="w-full p-3 bg-white/40 dark:bg-black/10 border border-[#b6ecff] dark:border-[#262626] rounded-xl hover:border-[#ff7a39] text-left text-xs font-semibold flex items-center gap-2 hover:bg-slate-200/10 text-slate-700 dark:text-slate-200 hover:text-[#ff7a39] dark:hover:text-[#ff925c] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <span className="text-[#ff7a39]">✏️</span> {language === 'es' ? 'Pregunta Abierta' : 'Open Text'}
                            </button>
                            <button
                                onClick={() => addQuestion('ASOCIATIVA')}
                                disabled={isReadOnly}
                                className="w-full p-3 bg-white/40 dark:bg-black/10 border border-[#b6ecff] dark:border-[#262626] rounded-xl hover:border-yellow-500 text-left text-xs font-semibold flex items-center gap-2 hover:bg-slate-200/10 text-slate-700 dark:text-slate-200 hover:text-yellow-500 dark:hover:text-yellow-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <span className="text-yellow-500">⇄</span> {language === 'es' ? 'Pregunta Asociativa' : 'Matching'}
                            </button>
                        </div>
                    </div>

                    <hr className="border-[#b6ecff]/20 dark:border-[#262626]" />

                    {/* sections list */}
                    <div className="flex-1 flex flex-col gap-3 min-h-[200px]">
                        <div className="flex justify-between items-center">
                            <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-600 dark:text-slate-400">{t('sections')}</h3>
                            {!isReadOnly && (
                                <button 
                                    onClick={addSection}
                                    className="text-xs font-bold text-[#ff7a39] hover:underline"
                                >
                                    ➕
                                </button>
                            )}
                        </div>
                        <div className="space-y-1.5 flex-1 overflow-y-auto pr-1">
                            {cuestionario.secciones.map((sec) => (
                                <div
                                    key={sec.id}
                                    onClick={() => setActiveSectionId(sec.id)}
                                    className={`w-full p-3 rounded-xl cursor-pointer border text-xs font-bold flex justify-between items-center transition-all ${
                                        activeSectionId === sec.id
                                            ? 'bg-[#00aae1]/10 border-[#00aae1] text-[#00aae1]'
                                            : 'bg-white/40 dark:bg-black/10 border-[#b6ecff] dark:border-[#262626] text-slate-700 dark:text-slate-200'
                                    }`}
                                >
                                    <span className="truncate max-w-[120px]">{sec.nombre}</span>
                                    {!isReadOnly && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                deleteSection(sec.id);
                                            }}
                                            className="text-slate-400 hover:text-red-500 transition-all font-semibold"
                                        >
                                            🗑️
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 2. Center Panel: Dynamic Flow Canvas */}
                <div className="flex-1 glass-panel border-[#b6ecff] dark:border-[#262626] overflow-hidden flex flex-col relative bg-slate-900/10">
                    
                    {/* Canvas header controls */}
                    <div className="p-3 border-b border-[#b6ecff]/20 dark:border-[#262626] flex justify-between items-center z-10 bg-white/10">
                        <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                            {activeSection ? activeSection.nombre : 'Canvas'}
                        </span>
                        <div className="flex gap-1.5">
                            <button 
                                onClick={() => setZoom(prev => Math.max(0.5, prev - 0.1))}
                                className="px-2.5 py-1 rounded bg-white/20 hover:bg-[#ff7a39]/20 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-[#ff7a39] dark:hover:text-[#ff925c] transition-all"
                                title="Zoom Out"
                            >
                                🔍-
                            </button>
                            <span className="text-xs flex items-center font-bold px-1.5 text-slate-400">{Math.round(zoom * 100)}%</span>
                            <button 
                                onClick={() => setZoom(prev => Math.min(1.5, prev + 0.1))}
                                className="px-2.5 py-1 rounded bg-white/20 hover:bg-[#ff7a39]/20 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-[#ff7a39] dark:hover:text-[#ff925c] transition-all"
                                title="Zoom In"
                            >
                                🔍+
                            </button>
                        </div>
                    </div>

                    {/* Canvas Area */}
                    <div 
                        id="canvas-scroll-container" 
                        onClick={() => setSelectedQuestionId(null)}
                        className="flex-1 overflow-auto p-8 relative flex flex-col justify-start items-center"
                    >
                        <div 
                            id="canvas-scale-container"
                            style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
                            className="transition-all duration-200 ease-out space-y-6 w-full max-w-lg relative"
                        >
                            {/* Section header edit in canvas */}
                            {activeSection && (
                                <div className="p-4 glass-panel border-cyan-400/20 mb-6 bg-white/20">
                                    <input
                                        type="text"
                                        value={activeSection.nombre || ''}
                                        onChange={(e) => updateSection(activeSection.id, 'nombre', e.target.value)}
                                        readOnly={isReadOnly}
                                        className="bg-transparent border-none outline-none font-bold text-white dark:text-[#fafafa] text-md w-full focus:ring-1 focus:ring-[#00aae1] rounded mb-1"
                                        placeholder={t('name')}
                                    />
                                    <input
                                        type="text"
                                        value={activeSection.descripcion || ''}
                                        onChange={(e) => updateSection(activeSection.id, 'descripcion', e.target.value)}
                                        readOnly={isReadOnly}
                                        className="bg-transparent border-none outline-none text-xs text-slate-400 w-full focus:ring-1 focus:ring-[#00aae1] rounded"
                                        placeholder={t('description')}
                                    />
                                </div>
                            )}

                            {/* Question Nodes */}
                            {activeSection && activeSection.preguntas && activeSection.preguntas.map((q, idx) => {
                                const isSelected = selectedQuestionId === q.id;
                                const isDragTarget = dragOverIdx === idx;
                                return (
                                    <div
                                        key={q.id}
                                        className="relative flex flex-col items-center"
                                        onDragOver={(e) => handleDragOver(e, idx)}
                                        onDrop={(e) => handleDrop(e, idx, activeSection.id)}
                                    >
                                        {/* Drop zone highlight above card */}
                                        {isDragTarget && (
                                            <div className="w-full h-1 rounded-full bg-[#00aae1] mb-1 animate-pulse" />
                                        )}

                                        {/* Card Node row: handle + card */}
                                        <div className="w-full flex items-stretch gap-2">

                                            {/* Drag handle */}
                                            <div
                                                draggable={!isReadOnly}
                                                onDragStart={(e) => handleDragStart(e, idx)}
                                                onDragEnd={handleDragEnd}
                                                className={`flex items-center justify-center w-7 shrink-0 rounded-xl text-slate-400 hover:text-[#00aae1] hover:bg-[#00aae1]/10 transition-all select-none border border-transparent hover:border-[#00aae1]/20 ${
                                                    isReadOnly ? 'cursor-not-allowed opacity-50' : 'cursor-grab active:cursor-grabbing'
                                                }`}
                                                title={isReadOnly ? (language === 'es' ? 'Solo lectura' : 'Read-only') : (language === 'es' ? 'Arrastrar para reordenar' : 'Drag to reorder')}
                                            >
                                                <span className="text-base leading-none" style={{ letterSpacing: '-1px' }}>⠿</span>
                                            </div>

                                            {/* Card */}
                                            <div
                                                id={`card-${q.codigo}`}
                                                onClick={(e) => { e.stopPropagation(); setSelectedQuestionId(q.id); }}
                                                className={`flex-1 p-5 glass-panel cursor-pointer relative border transition-all ${
                                                    isSelected
                                                        ? 'border-[#ff7a39] ring-2 ring-[#ff7a39]/20 scale-[1.01]'
                                                        : 'border-[#b6ecff] dark:border-[#262626] hover:border-[#00aae1]'
                                                }`}
                                            >
                                                <div className="flex justify-between items-center mb-2.5">
                                                    <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                                                        q.tipo_codigo === 'UNICA' ? 'bg-[#00aae1]/10 text-[#00aae1]' :
                                                        q.tipo_codigo === 'MULTIPLE' ? 'bg-[#01ae6c]/10 text-[#01ae6c]' :
                                                        q.tipo_codigo === 'ABIERTA' ? 'bg-[#ff7a39]/10 text-[#ff7a39]' :
                                                        'bg-yellow-500/10 text-yellow-500'
                                                    }`}>
                                                        {q.codigo} · {q.tipo_codigo}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 font-semibold">
                                                        {q.obligatoria === 1 ? `* ${t('required')}` : ''}
                                                    </span>
                                                </div>
                                                <p className="text-sm font-semibold text-white dark:text-[#fafafa] truncate">
                                                    {q.texto_pregunta || `Pregunta ${idx + 1}`}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Flow connector arrow to next question node */}
                                        {idx < activeSection.preguntas.length - 1 && (
                                            <div className="h-6 w-0.5 bg-slate-400/30 flex items-center justify-center my-0.5 ml-9">
                                                <span className="text-slate-400/40 text-[9px] select-none">▼</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {/* SVG connections overlay */}
                            <svg className="absolute inset-0 pointer-events-none w-full h-full overflow-visible z-0">
                                <defs>
                                    <marker 
                                        id="flow-arrow" 
                                        viewBox="0 0 10 10" 
                                        refX="8" 
                                        refY="5" 
                                        markerWidth="5" 
                                        markerHeight="5" 
                                        orient="auto-start-reverse"
                                    >
                                        <path d="M 0 0 L 10 5 L 0 10 z" fill="#ff7a39" />
                                    </marker>
                                </defs>
                                {renderFlowConnections()}
                            </svg>

                            {/* Flow Connection Labels */}
                            {renderFlowLabels()}

                            {(!activeSection || !activeSection.preguntas || activeSection.preguntas.length === 0) && (
                                <div className="text-center py-20 text-slate-400 text-xs font-bold uppercase tracking-widest">
                                    {language === 'es' ? 'Añada preguntas desde la biblioteca' : 'Add questions from the library'}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 3. Right Panel: Properties Panel (Conditional logic, Options, Scoring) */}
                <div className="w-96 glass-panel border-[#b6ecff] dark:border-[#262626] p-4 flex flex-col gap-4 overflow-y-auto">
                    
                    {selQuestion ? (
                        <div className="space-y-6">
                            
                            {/* Header */}
                            <div className="flex justify-between items-center border-b border-[#b6ecff]/10 dark:border-[#262626] pb-2 mb-2">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setSelectedQuestionId(null); }}
                                        className="p-1.5 rounded-lg border border-[#b6ecff]/30 dark:border-[#262626] hover:border-[#ff7a39] hover:bg-[#ff7a39]/10 text-slate-700 dark:text-slate-200 hover:text-[#ff7a39] dark:hover:text-[#ff7a39] transition-all text-xs font-bold"
                                        title={language === 'es' ? 'Volver a Variables/Rangos' : 'Back to Variables/Ranges'}
                                    >
                                        ⬅️
                                    </button>
                                    <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-650 dark:text-slate-400">{t('properties')}</h3>
                                </div>
                                {!isReadOnly && (
                                    <button
                                        onClick={() => deleteQuestion(selQuestion.id)}
                                        className="p-1.5 rounded bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all text-[10px] font-bold uppercase tracking-wider"
                                    >
                                        🗑️ {t('delete')}
                                    </button>
                                )}
                            </div>

                            {/* Core fields */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">Código</label>
                                    <input
                                        type="text"
                                        value={selQuestion.codigo || ''}
                                        readOnly
                                        className="w-full px-3 py-2 rounded-lg bg-slate-100/85 dark:bg-black/45 border border-[#b6ecff]/45 dark:border-[#262626]/45 text-slate-700 dark:text-slate-300 focus:outline-none text-xs font-bold select-none cursor-not-allowed"
                                        title={language === 'es' ? 'El código se genera automáticamente' : 'Code is automatically generated'}
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">{t('name')}</label>
                                    <input
                                        type="text"
                                        value={selQuestion.texto_pregunta || ''}
                                        onChange={(e) => updateQuestion(selQuestion.id, 'texto_pregunta', e.target.value)}
                                        readOnly={isReadOnly}
                                        className="w-full px-3 py-2 rounded-lg bg-white/40 dark:bg-black/20 border border-[#b6ecff] dark:border-[#262626] text-[#04354d] dark:text-[#fafafa] focus:outline-none focus:border-[#00aae1] text-xs font-semibold"
                                    />
                                </div>

                                <div className="flex gap-4">
                                    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-[#fafafa] cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={selQuestion.obligatoria === 1}
                                            onChange={(e) => updateQuestion(selQuestion.id, 'obligatoria', e.target.checked ? 1 : 0)}
                                            disabled={isReadOnly}
                                            className="rounded border-[#b6ecff] dark:border-[#262626] text-[#ff7a39] focus:ring-0 w-4 h-4 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                        />
                                        {t('required')}
                                    </label>
                                </div>
                            </div>

                            <hr className="border-[#b6ecff]/20 dark:border-[#262626]" />

                            {/* Section: Options (For selections) */}
                            {(selQuestion.tipo_codigo === 'UNICA' || selQuestion.tipo_codigo === 'MULTIPLE') && (
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-600 dark:text-slate-400">{t('options')}</span>
                                        {!isReadOnly && (
                                            <button 
                                                onClick={() => addOption(selQuestion.id)}
                                                className="text-xs font-bold text-[#00aae1] hover:underline"
                                            >
                                                ➕
                                            </button>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        {selQuestion.opciones && selQuestion.opciones.map((op, idx) => (
                                            <div key={op.id} className="p-3 bg-white/40 dark:bg-black/10 border border-[#b6ecff]/50 dark:border-[#262626] rounded-xl space-y-2 relative">
                                                {!isReadOnly && (
                                                    <button
                                                        onClick={() => deleteOption(selQuestion.id, op.id)}
                                                        className="absolute top-2 right-2 text-slate-400 hover:text-red-500 text-xs font-bold"
                                                    >
                                                        ✕
                                                    </button>
                                                )}
                                                <div className="grid grid-cols-2 gap-2 pr-4">
                                                    <div>
                                                        <label className="block text-[9px] font-semibold text-slate-600 dark:text-slate-400 mb-0.5">Código</label>
                                                        <input
                                                            type="text"
                                                            value={op.codigo_opcion}
                                                            onChange={(e) => updateOption(selQuestion.id, op.id, 'codigo_opcion', e.target.value.toUpperCase())}
                                                            readOnly={isReadOnly}
                                                            className="w-full px-2 py-1 rounded bg-white/40 dark:bg-black/20 border border-[#b6ecff]/50 dark:border-[#262626] text-xs font-bold text-[#04354d] dark:text-[#fafafa]"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[9px] font-semibold text-slate-600 dark:text-slate-400 mb-0.5">{t('points')}</label>
                                                        <input
                                                            type="number"
                                                            value={op.valor_opcion}
                                                            onChange={(e) => updateOption(selQuestion.id, op.id, 'valor_opcion', parseInt(e.target.value) || 0)}
                                                            readOnly={isReadOnly}
                                                            className="w-full px-2 py-1 rounded bg-white/40 dark:bg-black/20 border border-[#b6ecff]/50 dark:border-[#262626] text-xs font-bold text-[#04354d] dark:text-[#fafafa]"
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-[9px] font-semibold text-slate-600 dark:text-slate-400 mb-0.5">Texto</label>
                                                    <input
                                                        type="text"
                                                        value={op.texto_opcion}
                                                        onChange={(e) => updateOption(selQuestion.id, op.id, 'texto_opcion', e.target.value)}
                                                        readOnly={isReadOnly}
                                                        className="w-full px-2 py-1 rounded bg-white/40 dark:bg-black/20 border border-[#b6ecff]/50 dark:border-[#262626] text-xs font-medium text-[#04354d] dark:text-[#fafafa]"
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Section: Associations (Matching logic) */}
                            {selQuestion.tipo_codigo === 'ASOCIATIVA' && (
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-600 dark:text-slate-400">{t('asociations')}</span>
                                        {!isReadOnly && (
                                            <button 
                                                onClick={() => addAsociation(selQuestion.id)}
                                                className="text-xs font-bold text-[#00aae1] hover:underline"
                                            >
                                                ➕
                                            </button>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        {selQuestion.asociaciones && selQuestion.asociaciones.map((a, idx) => (
                                            <div key={a.id} className="p-3 bg-white/40 dark:bg-black/10 border border-[#b6ecff]/50 dark:border-[#262626] rounded-xl space-y-2 relative">
                                                {!isReadOnly && (
                                                    <button
                                                        onClick={() => deleteAsociation(selQuestion.id, a.id)}
                                                        className="absolute top-2 right-2 text-slate-400 hover:text-red-500 text-xs font-bold"
                                                    >
                                                        ✕
                                                    </button>
                                                )}
                                                <div>
                                                    <label className="block text-[9px] font-semibold text-slate-600 dark:text-slate-400 mb-0.5">{language === 'es' ? 'Columna Izquierda' : 'Left Column'}</label>
                                                    <input
                                                        type="text"
                                                        value={a.item_izquierdo}
                                                        onChange={(e) => updateAsociation(selQuestion.id, a.id, 'item_izquierdo', e.target.value)}
                                                        readOnly={isReadOnly}
                                                        className="w-full px-2 py-1 rounded bg-white/40 dark:bg-black/20 border border-[#b6ecff]/50 dark:border-[#262626] text-xs text-[#04354d]"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[9px] font-semibold text-slate-600 dark:text-slate-400 mb-0.5">{language === 'es' ? 'Columna Derecha (Correcta)' : 'Right Column (Correct)'}</label>
                                                    <input
                                                        type="text"
                                                        value={a.item_derecho}
                                                        onChange={(e) => updateAsociation(selQuestion.id, a.id, 'item_derecho', e.target.value)}
                                                        readOnly={isReadOnly}
                                                        className="w-full px-2 py-1 rounded bg-white/40 dark:bg-black/20 border border-[#b6ecff]/50 dark:border-[#262626] text-xs text-[#04354d]"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[9px] font-semibold text-slate-600 dark:text-slate-400 mb-0.5">{t('points')}</label>
                                                    <input
                                                        type="number"
                                                        value={a.valor_correcto}
                                                        onChange={(e) => updateAsociation(selQuestion.id, a.id, 'valor_correcto', parseInt(e.target.value) || 0)}
                                                        readOnly={isReadOnly}
                                                        className="w-full px-2 py-1 rounded bg-white/40 dark:bg-black/20 border border-[#b6ecff]/50 dark:border-[#262626] text-xs font-bold text-[#04354d] dark:text-[#fafafa]"
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <hr className="border-[#b6ecff]/20 dark:border-[#262626]" />

                            {/* Section: Logic flows originating from this question */}
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-600 dark:text-slate-400">{t('logicalFlows')}</span>
                                    {!isReadOnly && (
                                        <button 
                                            onClick={() => addLogicalFlow(selQuestion.codigo)}
                                            className="text-xs font-bold text-[#ff7a39] hover:underline"
                                        >
                                            ➕
                                        </button>
                                    )}
                                </div>
                                <div className="space-y-3">
                                    {cuestionario.flujos.filter(f => f.codigo_pregunta_origen === selQuestion.codigo).map((flow) => (
                                        <div key={flow.id} className="p-3 bg-white/40 dark:bg-black/10 border border-[#ff7a39]/30 rounded-xl space-y-2 relative">
                                            {!isReadOnly && (
                                                <button
                                                    onClick={() => deleteLogicalFlow(flow.id)}
                                                    className="absolute top-2 right-2 text-slate-400 hover:text-red-500 text-xs font-bold"
                                                >
                                                    ✕
                                                </button>
                                            )}
                                            
                                            {/* Choice filter (Option selector if question type supports options) */}
                                            {(selQuestion.tipo_codigo === 'UNICA' || selQuestion.tipo_codigo === 'MULTIPLE') && (
                                                <div>
                                                    <label className="block text-[9px] font-semibold text-slate-600 dark:text-slate-400 mb-0.5">{language === 'es' ? 'Si responde la opción' : 'If responds option'}</label>
                                                    <select
                                                        value={flow.codigo_opcion_respuesta || ''}
                                                        onChange={(e) => updateLogicalFlow(flow.id, 'codigo_opcion_respuesta', e.target.value || null)}
                                                        disabled={isReadOnly}
                                                        className="w-full px-2 py-1 rounded bg-white dark:bg-[#071724] border border-[#b6ecff]/50 dark:border-[#262626] text-xs text-[#04354d] dark:text-slate-200"
                                                    >
                                                        <option value="" className="bg-[#effaff] dark:bg-[#121c24] text-[#04354d] dark:text-slate-200">-- {t('select')} --</option>
                                                        {selQuestion.opciones && selQuestion.opciones.map(o => (
                                                            <option key={o.id} value={o.codigo_opcion} className="bg-[#effaff] dark:bg-[#121c24] text-[#04354d] dark:text-slate-200">
                                                                {o.codigo_opcion} ({o.texto_opcion})
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}

                                            {/* Jump Target Question */}
                                            <div>
                                                <label className="block text-[9px] font-semibold text-slate-600 dark:text-slate-450 mb-0.5">{language === 'es' ? 'Saltar a pregunta' : 'Jump to question'}</label>
                                                <select
                                                    value={flow.codigo_pregunta_destino}
                                                    onChange={(e) => updateLogicalFlow(flow.id, 'codigo_pregunta_destino', e.target.value)}
                                                    disabled={isReadOnly}
                                                    className="w-full px-2 py-1 rounded bg-white dark:bg-[#071724] border border-[#b6ecff]/50 dark:border-[#262626] text-xs text-[#04354d] dark:text-slate-200 font-bold"
                                                >
                                                    <option value="" className="bg-[#effaff] dark:bg-[#121c24] text-[#04354d] dark:text-slate-200">-- {t('select')} --</option>
                                                    {allQuestionsList.filter(q => q.codigo !== selQuestion.codigo).map(q => (
                                                        <option key={q.id} value={q.codigo} className="bg-[#effaff] dark:bg-[#121c24] text-[#04354d] dark:text-slate-200">
                                                            {q.codigo}: {q.texto_pregunta}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        // No selected question - show Questionnaire properties (Score classifications)
                        cuestionario.id_tipo_cuestionario === 2 ? (
                            <div className="space-y-6">
                                {/* Tab Headers */}
                                <div className="flex border-b border-[#c084fc]/30 dark:border-[#262626] pb-2 gap-2">
                                    <button
                                        onClick={() => setActivePropsTab('variables')}
                                        className={`flex-1 pb-1.5 text-center text-xs font-bold transition-all ${
                                            activePropsTab === 'variables'
                                                ? 'border-b-2 border-[#c084fc] text-[#c084fc]'
                                                : 'text-slate-400 hover:text-slate-200'
                                        }`}
                                    >
                                        {language === 'es' ? 'Variables' : 'Variables'}
                                    </button>
                                    <button
                                        onClick={() => setActivePropsTab('resultados')}
                                        className={`flex-1 pb-1.5 text-center text-xs font-bold transition-all ${
                                            activePropsTab === 'resultados'
                                                ? 'border-b-2 border-[#c084fc] text-[#c084fc]'
                                                : 'text-slate-400 hover:text-slate-200'
                                        }`}
                                    >
                                        {language === 'es' ? 'Rangos' : 'Ranges'}
                                    </button>
                                </div>

                                {activePropsTab === 'variables' ? (
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <h4 className="text-xs font-extrabold uppercase tracking-widest text-[#c084fc]">{language === 'es' ? 'Variables Clínicas' : 'Clinical Variables'}</h4>
                                                <p className="text-[9px] text-slate-500 font-medium">{language === 'es' ? 'Defina variables y asocie preguntas con pesos.' : 'Define variables and map questions with weights.'}</p>
                                            </div>
                                            {!isReadOnly && (
                                                <button
                                                    onClick={addClinicalVariable}
                                                    className="p-1 rounded bg-[#c084fc]/10 text-[#c084fc] hover:bg-[#c084fc] hover:text-white transition-all text-xs font-bold"
                                                    title={language === 'es' ? 'Agregar Variable' : 'Add Variable'}
                                                >
                                                    ➕
                                                </button>
                                            )}
                                        </div>

                                        <div className="space-y-4">
                                            {(cuestionario.variables || []).map((v) => (
                                                <div key={v.id} className="p-3 bg-purple-500/5 dark:bg-black/20 border border-[#c084fc]/30 rounded-xl space-y-3 relative">
                                                    {!isReadOnly && (
                                                        <button
                                                            onClick={() => deleteClinicalVariable(v.id)}
                                                            className="absolute top-2 right-2 text-slate-400 hover:text-red-500 text-xs font-bold"
                                                            title={language === 'es' ? 'Eliminar Variable' : 'Delete Variable'}
                                                        >
                                                            ✕
                                                        </button>
                                                    )}

                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div>
                                                            <label className="block text-[9px] font-semibold text-slate-550 dark:text-slate-400 mb-0.5">Código</label>
                                                            <input
                                                                type="text"
                                                                value={v.codigo || ''}
                                                                onChange={(e) => updateClinicalVariable(v.id, 'codigo', e.target.value.toUpperCase())}
                                                                readOnly={isReadOnly}
                                                                className="w-full px-2 py-1 rounded bg-white/40 dark:bg-black/20 border border-[#c084fc]/20 dark:border-[#262626] text-xs font-bold text-[#04354d] dark:text-[#fafafa]"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[9px] font-semibold text-slate-550 dark:text-slate-400 mb-0.5">{language === 'es' ? 'Nombre' : 'Name'}</label>
                                                            <input
                                                                type="text"
                                                                value={v.nombre || ''}
                                                                onChange={(e) => updateClinicalVariable(v.id, 'nombre', e.target.value)}
                                                                readOnly={isReadOnly}
                                                                className="w-full px-2 py-1 rounded bg-white/40 dark:bg-black/20 border border-[#c084fc]/20 dark:border-[#262626] text-xs font-semibold text-[#04354d] dark:text-[#fafafa]"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <label className="block text-[9px] font-semibold text-slate-550 dark:text-slate-400 mb-0.5">{language === 'es' ? 'Descripción' : 'Description'}</label>
                                                        <textarea
                                                            value={v.descripcion || ''}
                                                            onChange={(e) => updateClinicalVariable(v.id, 'descripcion', e.target.value)}
                                                            readOnly={isReadOnly}
                                                            rows="2"
                                                            className="w-full px-2 py-1 rounded bg-white/40 dark:bg-black/20 border border-[#c084fc]/20 dark:border-[#262626] text-xs text-[#04354d] dark:text-[#fafafa] resize-none"
                                                        />
                                                    </div>

                                                    {/* Associated questions sub-section */}
                                                    <div className="space-y-2 border-t border-[#c084fc]/20 pt-2">
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{language === 'es' ? 'Preguntas Asociadas' : 'Associated Questions'}</span>
                                                            {!isReadOnly && (
                                                                <button
                                                                    onClick={() => addClinicalVariableQuestion(v.id)}
                                                                    className="text-[10px] font-bold text-[#c084fc] hover:underline"
                                                                >
                                                                    ➕ {language === 'es' ? 'Asociar' : 'Map'}
                                                                </button>
                                                            )}
                                                        </div>

                                                        <div className="space-y-2">
                                                            {(v.preguntas_asociadas || []).map((assoc) => (
                                                                <div key={assoc.id} className="flex items-center gap-1.5 bg-white/60 dark:bg-black/30 p-1.5 rounded-lg border border-[#c084fc]/10">
                                                                    <select
                                                                        value={assoc.id_pregunta || ''}
                                                                        onChange={(e) => updateClinicalVariableQuestion(v.id, assoc.id, 'id_pregunta', parseInt(e.target.value) || '')}
                                                                        disabled={isReadOnly}
                                                                        className="flex-1 px-1.5 py-0.5 rounded bg-white dark:bg-[#071724] border border-[#c084fc]/20 dark:border-[#262626] text-xs text-slate-800 dark:text-slate-200"
                                                                    >
                                                                        <option value="">-- {language === 'es' ? 'Pregunta' : 'Question'} --</option>
                                                                        {allQuestionsList.map(q => (
                                                                            <option key={q.id} value={q.id}>
                                                                                {q.codigo} ({q.texto_pregunta.slice(0, 20)}...)
                                                                            </option>
                                                                        ))}
                                                                    </select>

                                                                    <div className="w-20">
                                                                        <input
                                                                            type="number"
                                                                            value={assoc.peso}
                                                                            onChange={(e) => updateClinicalVariableQuestion(v.id, assoc.id, 'peso', parseFloat(e.target.value) || 0)}
                                                                            readOnly={isReadOnly}
                                                                            placeholder="peso"
                                                                            className="w-full px-1.5 py-0.5 rounded bg-white/40 dark:bg-black/20 border border-[#c084fc]/20 dark:border-[#262626] text-xs font-bold text-center text-slate-800 dark:text-[#fafafa]"
                                                                            title="Peso / Multiplicador"
                                                                        />
                                                                    </div>

                                                                    {!isReadOnly && (
                                                                        <button
                                                                            onClick={() => deleteClinicalVariableQuestion(v.id, assoc.id)}
                                                                            className="text-slate-400 hover:text-red-500 text-xs font-bold px-1"
                                                                        >
                                                                            ✕
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    /* Interpretation Ranges */
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center">
                                            <div>
                                                <h4 className="text-xs font-extrabold uppercase tracking-widest text-[#c084fc]">{language === 'es' ? 'Rangos Clínicos' : 'Clinical Interpretation'}</h4>
                                                <p className="text-[9px] text-slate-500 font-medium">{language === 'es' ? 'Establezca límites, diagnósticos y colores.' : 'Set scoring limits, classifications, and colors.'}</p>
                                            </div>
                                            {!isReadOnly && (
                                                <button
                                                    onClick={addClinicalRange}
                                                    className="p-1 rounded bg-[#c084fc]/10 text-[#c084fc] hover:bg-[#c084fc] hover:text-white transition-all text-xs font-bold"
                                                    title={language === 'es' ? 'Agregar Rango' : 'Add Range'}
                                                >
                                                    ➕
                                                </button>
                                            )}
                                        </div>

                                        <div className="space-y-3">
                                            {(cuestionario.resultados_clinicos || []).map((res) => (
                                                <div key={res.id} className="p-3 bg-purple-500/5 dark:bg-black/20 border border-[#c084fc]/30 rounded-xl space-y-2 relative">
                                                    {!isReadOnly && (
                                                        <button
                                                            onClick={() => deleteClinicalRange(res.id)}
                                                            className="absolute top-2 right-2 text-slate-450 hover:text-red-500 text-xs font-bold"
                                                        >
                                                            ✕
                                                        </button>
                                                    )}

                                                    <div>
                                                        <label className="block text-[9px] font-semibold text-slate-655 dark:text-slate-400 mb-0.5 uppercase tracking-wider">
                                                            {language === 'es' ? 'Variable Clínica Asociada' : 'Associated Clinical Variable'}
                                                        </label>
                                                        <select
                                                            value={res.id_variable_calculada || ''}
                                                            onChange={(e) => updateClinicalRange(res.id, 'id_variable_calculada', e.target.value ? parseInt(e.target.value) : null)}
                                                            disabled={isReadOnly}
                                                            className="w-full px-2 py-1 rounded bg-white dark:bg-[#071724] border border-[#c084fc]/20 dark:border-[#262626] text-xs text-[#04354d] dark:text-[#fafafa] font-bold"
                                                        >
                                                            <option value="">{language === 'es' ? '-- Seleccionar Variable --' : '-- Select Variable --'}</option>
                                                            {(cuestionario.variables || []).map(v => (
                                                                <option key={v.id} value={v.id}>{v.nombre} ({v.codigo})</option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div>
                                                            <label className="block text-[9px] font-semibold text-slate-650 dark:text-slate-400 mb-0.5">{language === 'es' ? 'Rango' : 'Label'}</label>
                                                            <input
                                                                type="text"
                                                                value={res.nombre_rango || ''}
                                                                onChange={(e) => updateClinicalRange(res.id, 'nombre_rango', e.target.value)}
                                                                readOnly={isReadOnly}
                                                                placeholder="Ej. Moderado"
                                                                className="w-full px-2 py-1 rounded bg-white/40 dark:bg-black/20 border border-[#c084fc]/20 dark:border-[#262626] text-xs text-[#04354d] dark:text-[#fafafa] font-bold"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[9px] font-semibold text-slate-650 dark:text-slate-400 mb-0.5">Color</label>
                                                            <select
                                                                value={res.color_visual || 'green'}
                                                                onChange={(e) => updateClinicalRange(res.id, 'color_visual', e.target.value)}
                                                                disabled={isReadOnly}
                                                                className="w-full px-2 py-1 rounded bg-white dark:bg-[#071724] border border-[#c084fc]/20 dark:border-[#262626] text-xs text-[#04354d] dark:text-slate-200"
                                                            >
                                                                <option value="green">Verde</option>
                                                                <option value="orange">Naranja</option>
                                                                <option value="red">Rojo</option>
                                                                <option value="blue">Azul</option>
                                                            </select>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div>
                                                            <label className="block text-[9px] font-semibold text-slate-650 dark:text-slate-400 mb-0.5">{language === 'es' ? 'Mínimo' : 'Min Score'}</label>
                                                            <input
                                                                type="number"
                                                                value={res.valor_minimo}
                                                                onChange={(e) => updateClinicalRange(res.id, 'valor_minimo', parseInt(e.target.value) || 0)}
                                                                readOnly={isReadOnly}
                                                                className="w-full px-2 py-1 rounded bg-white/40 dark:bg-black/20 border border-[#c084fc]/20 dark:border-[#262626] text-xs font-bold text-[#04354d] dark:text-[#fafafa]"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[9px] font-semibold text-slate-650 dark:text-slate-400 mb-0.5">{language === 'es' ? 'Máximo' : 'Max Score'}</label>
                                                            <input
                                                                type="number"
                                                                value={res.valor_maximo}
                                                                onChange={(e) => updateClinicalRange(res.id, 'valor_maximo', parseInt(e.target.value) || 0)}
                                                                readOnly={isReadOnly}
                                                                className="w-full px-2 py-1 rounded bg-white/40 dark:bg-black/20 border border-[#c084fc]/20 dark:border-[#262626] text-xs font-bold text-[#04354d] dark:text-[#fafafa]"
                                                            />
                                                        </div>
                                                    </div>

                                                    <div>
                                                        <label className="block text-[9px] font-semibold text-slate-655 dark:text-slate-400 mb-0.5">{language === 'es' ? 'Clasificación Clínica' : 'Clinical Classification'}</label>
                                                        <input
                                                            type="text"
                                                            value={res.clasificacion || ''}
                                                            onChange={(e) => updateClinicalRange(res.id, 'clasificacion', e.target.value)}
                                                            readOnly={isReadOnly}
                                                            placeholder="Ej. Depresión Moderada"
                                                            className="w-full px-2 py-1 rounded bg-white/40 dark:bg-black/20 border border-[#c084fc]/20 dark:border-[#262626] text-xs text-[#04354d] dark:text-[#fafafa] font-semibold"
                                                        />
                                                    </div>

                                                    <div>
                                                        <label className="block text-[9px] font-semibold text-slate-655 dark:text-slate-400 mb-0.5">{language === 'es' ? 'Descripción Clínica' : 'Clinical Description'}</label>
                                                        <textarea
                                                            value={res.descripcion || ''}
                                                            onChange={(e) => updateClinicalRange(res.id, 'descripcion', e.target.value)}
                                                            readOnly={isReadOnly}
                                                            rows="3"
                                                            className="w-full px-2 py-1 rounded bg-white/40 dark:bg-black/20 border border-[#c084fc]/20 dark:border-[#262626] text-xs text-[#04354d] dark:text-[#fafafa] resize-none"
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-600 dark:text-slate-400 mb-2">{t('results')}</h3>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-450 font-medium leading-relaxed">
                                        {language === 'es' ? 'Defina los rangos de puntaje y clasificaciones finales.' : 'Define scoring ranges and classification labels.'}
                                    </p>
                                </div>

                                {!isReadOnly && (
                                    <button
                                        onClick={addResultClassification}
                                        className="w-full py-2 border border-[#b6ecff] dark:border-[#262626] hover:border-[#ff7a39] hover:bg-[#ff7a39]/10 text-slate-700 dark:text-slate-200 hover:text-[#ff7a39] dark:hover:text-[#ff7a39] text-xs font-bold uppercase rounded-lg transition-all"
                                    >
                                        ➕ {t('addResult')}
                                    </button>
                                )}

                                <div className="space-y-3">
                                    {cuestionario.resultados.map((res) => (
                                        <div key={res.id} className="p-3 bg-white/40 dark:bg-black/10 border border-[#b6ecff]/30 dark:border-[#262626] rounded-xl space-y-2 relative">
                                            {!isReadOnly && (
                                                <button
                                                    onClick={() => deleteResultClassification(res.id)}
                                                    className="absolute top-2 right-2 text-slate-400 hover:text-red-500 text-xs font-bold"
                                                >
                                                    ✕
                                                </button>
                                            )}
                                            
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="block text-[9px] font-semibold text-slate-650 dark:text-slate-400 mb-0.5">{language === 'es' ? 'Mínimo' : 'Min'}</label>
                                                    <input
                                                        type="number"
                                                        value={res.puntaje_desde}
                                                        onChange={(e) => updateResultClassification(res.id, 'puntaje_desde', parseInt(e.target.value) || 0)}
                                                        readOnly={isReadOnly}
                                                        className="w-full px-2 py-1 rounded bg-white/40 dark:bg-black/20 border border-[#b6ecff]/50 dark:border-[#262626] text-xs text-[#04354d] dark:text-[#fafafa]"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[9px] font-semibold text-slate-655 dark:text-slate-400 mb-0.5">{language === 'es' ? 'Máximo' : 'Max'}</label>
                                                    <input
                                                        type="number"
                                                        value={res.puntaje_hasta}
                                                        onChange={(e) => updateResultClassification(res.id, 'puntaje_hasta', parseInt(e.target.value) || 0)}
                                                        readOnly={isReadOnly}
                                                        className="w-full px-2 py-1 rounded bg-white/40 dark:bg-black/20 border border-[#b6ecff]/50 dark:border-[#262626] text-xs text-[#04354d] dark:text-[#fafafa]"
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-[9px] font-semibold text-slate-660 dark:text-slate-400 mb-0.5">Clasificación</label>
                                                <input
                                                    type="text"
                                                    value={res.nombre_resultado}
                                                    onChange={(e) => updateResultClassification(res.id, 'nombre_resultado', e.target.value)}
                                                    readOnly={isReadOnly}
                                                    className="w-full px-2 py-1 rounded bg-white/40 dark:bg-black/20 border border-[#b6ecff]/50 dark:border-[#262626] text-xs text-[#04354d] dark:text-[#fafafa]"
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="block text-[9px] font-semibold text-slate-670 dark:text-slate-400 mb-0.5">Color</label>
                                                    <select
                                                        value={res.color}
                                                        onChange={(e) => updateResultClassification(res.id, 'color', e.target.value)}
                                                        disabled={isReadOnly}
                                                        className="w-full px-2 py-1 rounded bg-white dark:bg-[#071724] border border-[#b6ecff]/50 dark:border-[#262626] text-xs text-[#04354d] dark:text-slate-200"
                                                    >
                                                        <option value="green" className="bg-[#effaff] dark:bg-[#121c24] text-[#04354d] dark:text-slate-200">Verde</option>
                                                        <option value="orange" className="bg-[#effaff] dark:bg-[#121c24] text-[#04354d] dark:text-slate-200">Naranja</option>
                                                        <option value="red" className="bg-[#effaff] dark:bg-[#121c24] text-[#04354d] dark:text-slate-200">Rojo</option>
                                                        <option value="blue" className="bg-[#effaff] dark:bg-[#121c24] text-[#04354d] dark:text-slate-200">Azul</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    )}
            </div>
        </div>

        {/* Modal de Ayuda */}
        {showHelpModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
                <div className="w-full max-w-4xl h-[80vh] glass-panel border-[#00aae1]/30 dark:border-[#06b6d4]/30 flex flex-col shadow-2xl overflow-hidden animate-scale-up bg-[#effaff]/98 dark:bg-[#071724]/98">
                    {/* Header */}
                    <div className="p-5 border-b border-[#00aae1]/20 dark:border-[#06b6d4]/20 flex justify-between items-center bg-[#effaff]/50 dark:bg-[#040e16]/80">
                        <div className="flex items-center gap-2">
                            <span className="text-xl">📖</span>
                            <h3 className="text-base font-bold text-[#04354d] dark:text-[#fafafa]">
                                {language === 'es' ? 'Guía del Constructor de Cuestionarios' : 'Questionnaire Builder User Guide'}
                            </h3>
                        </div>
                        <button
                            onClick={() => setShowHelpModal(false)}
                            className="text-slate-600 dark:text-slate-400 hover:text-red-500 text-lg font-bold p-1 hover:bg-white/10 rounded-lg transition-all"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Tabs Bar */}
                    <div className="flex border-b border-[#00aae1]/20 dark:border-[#06b6d4]/20 bg-[#b6ecff]/20 dark:bg-[#040e16]/80 px-4 py-2 gap-2 overflow-x-auto">
                        <button
                            onClick={() => setActiveHelpTab('secciones')}
                            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                                activeHelpTab === 'secciones'
                                    ? 'bg-[#00aae1] text-slate-50'
                                    : 'hover:bg-[#00aae1]/10 text-slate-700 hover:text-[#00aae1] dark:hover:bg-white/5 text-slate-705 dark:text-slate-300 dark:hover:text-white'
                            }`}
                        >
                            🗂️ {language === 'es' ? 'Secciones y Preguntas' : 'Sections & Questions'}
                        </button>
                        <button
                            onClick={() => setActiveHelpTab('flujos')}
                            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                                activeHelpTab === 'flujos'
                                    ? 'bg-[#ff7a39] text-slate-50'
                                    : 'hover:bg-[#00aae1]/10 text-slate-700 hover:text-[#00aae1] dark:hover:bg-white/5 text-slate-705 dark:text-slate-300 dark:hover:text-white'
                            }`}
                        >
                            🔀 {language === 'es' ? 'Flujos Lógicos' : 'Logical Flows'}
                        </button>
                        <button
                            onClick={() => setActiveHelpTab('resultados')}
                            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                                activeHelpTab === 'resultados'
                                    ? 'bg-[#01ae6c] text-slate-50'
                                    : 'hover:bg-[#00aae1]/10 text-slate-700 hover:text-[#00aae1] dark:hover:bg-white/5 text-slate-705 dark:text-slate-300 dark:hover:text-white'
                            }`}
                        >
                            📊 {language === 'es' ? 'Resultados y Clasificaciones' : 'Results & Classifications'}
                        </button>
                        <button
                            onClick={() => setActiveHelpTab('tipos')}
                            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                                activeHelpTab === 'tipos'
                                    ? 'bg-[#8b5cf6] text-slate-50'
                                    : 'hover:bg-[#00aae1]/10 text-slate-700 hover:text-[#00aae1] dark:hover:bg-white/5 text-slate-705 dark:text-slate-300 dark:hover:text-white'
                            }`}
                        >
                            📋 {language === 'es' ? 'Tipos de Cuestionario' : 'Questionnaire Types'}
                        </button>
                        <button
                            onClick={() => setActiveHelpTab('presentacion')}
                            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                                activeHelpTab === 'presentacion'
                                    ? 'bg-[#06b6d4] text-slate-50'
                                    : 'hover:bg-[#00aae1]/10 text-slate-700 hover:text-[#00aae1] dark:hover:bg-white/5 text-slate-705 dark:text-slate-300 dark:hover:text-white'
                            }`}
                        >
                            📄 {language === 'es' ? 'Presentación' : 'Layout'}
                        </button>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {activeHelpTab === 'secciones' && (
                            <div className="space-y-6">
                                {/* Secciones */}
                                <div className="p-4 rounded-xl bg-white/90 dark:bg-[#0a1e2b]/80 border border-[#00aae1]/20 dark:border-[#06b6d4]/20 space-y-2 shadow-sm">
                                    <h4 className="text-sm font-bold text-[#04354d] dark:text-[#fafafa] flex items-center gap-2">
                                        <span className="text-[#00aae1]">📁</span> {language === 'es' ? 'Secciones' : 'Sections'}
                                    </h4>
                                    <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
                                        {language === 'es' 
                                            ? 'Permiten agrupar preguntas en páginas o pasos independientes. Al responder el cuestionario, cada sección representa una pantalla separada.'
                                            : 'Allow grouping questions into pages or independent steps. When responding to the questionnaire, each section represents a separate screen.'}
                                    </p>
                                    <div className="text-[11px] text-slate-705 dark:text-slate-300 bg-[#effaff]/90 dark:bg-[#05141e]/90 p-3 rounded-lg space-y-1.5 border border-[#00aae1]/10 dark:border-[#06b6d4]/10">
                                        <div><span className="text-[#ff7a39] dark:text-[#ffa36c] font-bold">{language === 'es' ? 'Cómo se usa:' : 'How to use:'}</span> {language === 'es' ? 'Haz clic en "➕" junto a Secciones en el panel izquierdo. Para editar el nombre y descripción, selecciónala y edítala en la parte superior del canvas central.' : 'Click "➕" next to Sections in the left panel. To edit the name and description, select it and modify it at the top of the center canvas.'}</div>
                                        <div><span className="text-[#ff7a39] dark:text-[#ffa36c] font-bold">{language === 'es' ? 'Ejemplo:' : 'Example:'}</span> {language === 'es' ? 'Sección 1: "Datos Demográficos"; Sección 2: "Síntomas Principales"; Sección 3: "Evaluación de Riesgo".' : 'Section 1: "Demographics"; Section 2: "Key Symptoms"; Section 3: "Risk Assessment".'}</div>
                                    </div>
                                </div>

                                {/* Selección Única */}
                                <div className="p-4 rounded-xl bg-white/90 dark:bg-[#0a1e2b]/80 border border-[#00aae1]/20 dark:border-[#06b6d4]/20 space-y-2 shadow-sm">
                                    <h4 className="text-sm font-bold text-[#04354d] dark:text-[#fafafa] flex items-center gap-2">
                                        <span className="text-[#00aae1]">●</span> {language === 'es' ? 'Selección Única' : 'Single Choice'}
                                    </h4>
                                    <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
                                        {language === 'es' 
                                            ? 'El usuario solo puede marcar una única opción de la lista. Útil para preguntas de tipo Sí/No o escalas cerradas. Cada opción puede sumar puntos.'
                                            : 'The user can only select a single option from the list. Useful for Yes/No questions or closed scales. Each option can award points.'}
                                    </p>
                                    <div className="text-[11px] text-slate-705 dark:text-slate-300 bg-[#effaff]/90 dark:bg-[#05141e]/90 p-3 rounded-lg space-y-1.5 border border-[#00aae1]/10 dark:border-[#06b6d4]/10">
                                        <div><span className="text-[#ff7a39] dark:text-[#ffa36c] font-bold">{language === 'es' ? 'Cómo se usa:' : 'How to use:'}</span> {language === 'es' ? 'Agrega la pregunta desde la biblioteca. En el panel derecho de propiedades, haz clic en "➕" en Opciones. Escribe el código (ej. OP1), los puntos y el texto.' : 'Add the question from the library. In the right properties panel, click "➕" under Options. Write the code (e.g. OP1), points, and option text.'}</div>
                                        <div><span className="text-[#ff7a39] dark:text-[#ffa36c] font-bold">{language === 'es' ? 'Ejemplo:' : 'Example:'}</span> {language === 'es' ? '"¿Fuma actualmente?" -> Sí (5 pts), No (0 pts).' : '"Do you currently smoke?" -> Yes (5 pts), No (0 pts).'}</div>
                                    </div>
                                </div>

                                {/* Selección Múltiple */}
                                <div className="p-4 rounded-xl bg-white/90 dark:bg-[#0a1e2b]/80 border border-[#00aae1]/20 dark:border-[#06b6d4]/20 space-y-2 shadow-sm">
                                    <h4 className="text-sm font-bold text-[#04354d] dark:text-[#fafafa] flex items-center gap-2">
                                        <span className="text-[#01ae6c]">☑️</span> {language === 'es' ? 'Selección Múltiple' : 'Multiple Choice'}
                                    </h4>
                                    <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
                                        {language === 'es' 
                                            ? 'Permite al encuestado seleccionar múltiples opciones simultáneamente. Cada opción seleccionada acumula puntos al total.'
                                            : 'Allows the respondent to select multiple options simultaneously. Each checked option accumulates points toward the total score.'}
                                    </p>
                                    <div className="text-[11px] text-slate-705 dark:text-slate-300 bg-[#effaff]/90 dark:bg-[#05141e]/90 p-3 rounded-lg space-y-1.5 border border-[#00aae1]/10 dark:border-[#06b6d4]/10">
                                        <div><span className="text-[#ff7a39] dark:text-[#ffa36c] font-bold">{language === 'es' ? 'Cómo se usa:' : 'How to use:'}</span> {language === 'es' ? 'Se configura igual que Selección Única en el panel derecho. El usuario final verá casillas de verificación (checkboxes).' : 'Configured the same as Single Choice in the right panel. The respondent will see checkboxes.'}</div>
                                        <div><span className="text-[#ff7a39] dark:text-[#ffa36c] font-bold">{language === 'es' ? 'Ejemplo:' : 'Example:'}</span> {language === 'es' ? '"Marque los síntomas que presenta:" -> Tos (1 pt), Fiebre (2 pts), Dificultad para respirar (5 pts). Si marca los tres, suma 8 puntos.' : '"Select the symptoms you present:" -> Cough (1 pt), Fever (2 pts), Shortness of breath (5 pts). If they select all three, they get 8 points.'}</div>
                                    </div>
                                </div>

                                {/* Pregunta Abierta */}
                                <div className="p-4 rounded-xl bg-white/90 dark:bg-[#0a1e2b]/80 border border-[#00aae1]/20 dark:border-[#06b6d4]/20 space-y-2 shadow-sm">
                                    <h4 className="text-sm font-bold text-[#04354d] dark:text-[#fafafa] flex items-center gap-2">
                                        <span className="text-[#ff7a39]">✏️</span> {language === 'es' ? 'Pregunta Abierta' : 'Open Text'}
                                    </h4>
                                    <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
                                        {language === 'es' 
                                            ? 'Campo de texto libre para explicaciones o diagnósticos. No otorga puntos al score total.'
                                            : 'Free text field for explanations, feedback, or diagnostics. Does not award points to the total score.'}
                                    </p>
                                    <div className="text-[11px] text-slate-705 dark:text-slate-300 bg-[#effaff]/90 dark:bg-[#05141e]/90 p-3 rounded-lg space-y-1.5 border border-[#00aae1]/10 dark:border-[#06b6d4]/10">
                                        <div><span className="text-[#ff7a39] dark:text-[#ffa36c] font-bold">{language === 'es' ? 'Cómo se usa:' : 'How to use:'}</span> {language === 'es' ? 'Añádela desde la biblioteca de preguntas. Úsala cuando no existan opciones de respuesta predefinidas.' : 'Add it from the question library. Use it when there are no predefined response choices.'}</div>
                                        <div><span className="text-[#ff7a39] dark:text-[#ffa36c] font-bold">{language === 'es' ? 'Ejemplo:' : 'Example:'}</span> {language === 'es' ? '"Describa detalladamente los antecedentes familiares de diabetes".' : '"Describe in detail any family history of diabetes".'}</div>
                                    </div>
                                </div>

                                {/* Pregunta Asociativa */}
                                <div className="p-4 rounded-xl bg-white/90 dark:bg-[#0a1e2b]/80 border border-[#00aae1]/20 dark:border-[#06b6d4]/20 space-y-2 shadow-sm">
                                    <h4 className="text-sm font-bold text-[#04354d] dark:text-[#fafafa] flex items-center gap-2">
                                        <span className="text-yellow-500">⇄</span> {language === 'es' ? 'Pregunta Asociativa' : 'Matching'}
                                    </h4>
                                    <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
                                        {language === 'es' 
                                            ? 'Pregunta de emparejamiento. El usuario debe relacionar un elemento de la izquierda con el correspondiente correcto a la derecha.'
                                            : 'Matching question. The user must match a concept on the left with the correct equivalent on the right.'}
                                    </p>
                                    <div className="text-[11px] text-slate-705 dark:text-slate-300 bg-[#effaff]/90 dark:bg-[#05141e]/90 p-3 rounded-lg space-y-1.5 border border-[#00aae1]/10 dark:border-[#06b6d4]/10">
                                        <div><span className="text-[#ff7a39] dark:text-[#ffa36c] font-bold">{language === 'es' ? 'Cómo se usa:' : 'How to use:'}</span> {language === 'es' ? 'Agrega la pregunta. En el panel derecho, haz clic en "➕" en Correspondencias. Define el Elemento Izquierdo, el Elemento Derecho correcto y los puntos por emparejamiento exitoso.' : 'Add the question. In the right panel, click "➕" under Matching Pairs. Define the Left Element, the correct Right Element, and the points awarded for a successful match.'}</div>
                                        <div><span className="text-[#ff7a39] dark:text-[#ffa36c] font-bold">{language === 'es' ? 'Ejemplo:' : 'Example:'}</span> {language === 'es' ? 'Columna Izquierda: "Hipertensión" ⇄ Columna Derecha: "Cardiología" (5 pts).' : 'Left Column: "Hypertension" ⇄ Right Column: "Cardiology" (5 pts).'}</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeHelpTab === 'flujos' && (
                            <div className="space-y-6">
                                {/* Flujos Lógicos */}
                                <div className="p-4 rounded-xl bg-white/90 dark:bg-[#0a1e2b]/80 border border-[#00aae1]/20 dark:border-[#06b6d4]/20 space-y-2 shadow-sm">
                                    <h4 className="text-sm font-bold text-[#04354d] dark:text-[#fafafa] flex items-center gap-2">
                                        <span className="text-[#ff7a39]">🔀</span> {language === 'es' ? 'Flujos Lógicos y Reglas Condicionales' : 'Logical Flows & Conditional Rules'}
                                    </h4>
                                    <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
                                        {language === 'es' 
                                            ? 'Permiten saltar preguntas o secciones completas basándose en lo que responde el usuario, en lugar de seguir un cuestionario rígido de arriba a abajo.'
                                            : 'Allow jumping questions or entire sections based on what the user responds, instead of following a rigid top-to-bottom order.'}
                                    </p>
                                    <div className="text-[11px] text-slate-705 dark:text-slate-300 bg-[#effaff]/90 dark:bg-[#05141e]/90 p-3 rounded-lg space-y-1.5 border border-[#00aae1]/10 dark:border-[#06b6d4]/10">
                                        <div><span className="text-[#ff7a39] dark:text-[#ffa36c] font-bold">{language === 'es' ? 'Cómo se usa:' : 'How to use:'}</span> {language === 'es' ? 'Selecciona una pregunta (de Selección Única o Múltiple). En el panel derecho de propiedades, ve a Flujos Lógicos, presiona "➕", elige la opción de disparo y el código de la pregunta destino.' : 'Select a question (Single or Multiple Choice). In the right properties panel, go to Logical Flows, click "➕", select the triggering option and the target question code.'}</div>
                                        <div><span className="text-[#ff7a39] dark:text-[#ffa36c] font-bold">{language === 'es' ? 'Ejemplo:' : 'Example:'}</span> {language === 'es' ? 'En la pregunta P1 (¿Tiene dolor abdominal?), si responde "No" (OP2), se agrega una regla para saltar a P3 (¿Tiene dolor de cabeza?). Así se omite P2 (¿En qué parte del abdomen?), la cual ya no es relevante.' : 'In question P1 (Do you have abdominal pain?), if they answer "No" (OP2), add a rule to jump to P3 (Do you have a headache?). This skips P2 (Where in the abdomen is the pain?), which is no longer relevant.'}</div>
                                    </div>
                                </div>

                                {/* Validaciones */}
                                <div className="p-4 rounded-xl bg-white/90 dark:bg-[#0a1e2b]/80 border border-[#00aae1]/20 dark:border-[#06b6d4]/20 space-y-2 shadow-sm">
                                    <h4 className="text-sm font-bold text-[#04354d] dark:text-[#fafafa] flex items-center gap-2">
                                        <span className="text-yellow-500">⚠️</span> {language === 'es' ? 'Validación de Consistencia' : 'Consistency Validation'}
                                    </h4>
                                    <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
                                        {language === 'es' 
                                            ? 'El constructor valida tu cuestionario en tiempo real para evitar errores que bloqueen al usuario final:'
                                            : 'The builder validates your questionnaire in real-time to prevent errors that block the end user:'}
                                    </p>
                                    <ul className="list-disc pl-5 text-xs text-slate-705 dark:text-slate-350 space-y-1.5 font-medium">
                                        <li>
                                            <strong className="text-[#ff7a39] dark:text-[#ffa36c]">{language === 'es' ? 'Ciclo / Bucle Infinito:' : 'Infinite Loop:'}</strong> {language === 'es' ? 'Ocurre cuando la navegación regresa cíclicamente a un punto anterior sin salida (ej. P1 -> P2 -> P1). El constructor impide guardar el cuestionario si existen bucles activos.' : 'Occurs when navigation cycles back to a previous point without an exit path (e.g. P1 -> P2 -> P1). The builder prevents saving if there are active loops.'}
                                        </li>
                                        <li>
                                            <strong className="text-[#ff7a39] dark:text-[#ffa36c]">{language === 'es' ? 'Preguntas Huérfanas:' : 'Orphan Questions:'}</strong> {language === 'es' ? 'Preguntas que han quedado inalcanzables debido a que ningún flujo condicional ni la navegación natural del cuestionario lleva a ellas. Se muestra como una advertencia.' : 'Questions that have become unreachable because no logic flow or natural order leads to them. Displayed as a warning.'}
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        )}

                        {activeHelpTab === 'resultados' && (
                            <div className="space-y-6">
                                {/* Resultados */}
                                <div className="p-4 rounded-xl bg-white/90 dark:bg-[#0a1e2b]/80 border border-[#00aae1]/20 dark:border-[#06b6d4]/20 space-y-2 shadow-sm">
                                    <h4 className="text-sm font-bold text-[#01ae6c] flex items-center gap-2">
                                        <span className="text-[#01ae6c]">📊</span> {language === 'es' ? 'Clasificación por Puntaje' : 'Score Classifications'}
                                    </h4>
                                    <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
                                        {language === 'es' 
                                            ? 'Define la evaluación final que se presentará al encuestado cuando complete el cuestionario, sumando los puntos acumulados por sus respuestas.'
                                            : 'Defines the final evaluation presented to the respondent upon completion, based on the sum of points accumulated from their answers.'}
                                    </p>
                                    <div className="text-[11px] text-slate-705 dark:text-slate-300 bg-[#effaff]/90 dark:bg-[#05141e]/90 p-3 rounded-lg space-y-1.5 border border-[#00aae1]/10 dark:border-[#06b6d4]/10">
                                        <div><span className="text-[#ff7a39] dark:text-[#ffa36c] font-bold">{language === 'es' ? 'Cómo se usa:' : 'How to use:'}</span> {language === 'es' ? 'Haz clic en un área vacía del lienzo para deseleccionar cualquier pregunta. En el panel de propiedades derecho, bajo "Resultados", haz clic en "➕ Añadir Rango de Puntaje". Escribe los límites (Ej. Desde 0 Hasta 10), el nombre y el color semántico.' : 'Click an empty area on the canvas to deselect any question. In the right properties panel, under "Results Classifications", click "➕ Add Score Range". Write the limits (e.g. Min 0 Max 10), name, and status color.'}</div>
                                        <div><span className="text-[#ff7a39] dark:text-[#ffa36c] font-bold">{language === 'es' ? 'Ejemplo:' : 'Example:'}</span></div>
                                        <ul className="list-disc pl-5 space-y-1 font-medium">
                                            <li>{language === 'es' ? '0 a 10 puntos: "Riesgo Mínimo" (Verde)' : '0 to 10 points: "Minimal Risk" (Green)'}</li>
                                            <li>{language === 'es' ? '11 a 20 puntos: "Riesgo Moderado" (Naranja)' : '11 to 20 points: "Moderate Risk" (Orange)'}</li>
                                            <li>{language === 'es' ? '21 a 35 puntos: "Riesgo Severo" (Rojo)' : '21 to 35 points: "Severe Risk" (Red)'}</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeHelpTab === 'tipos' && (
                            <div className="space-y-6">
                                {/* Explicación General */}
                                <div className="p-4 rounded-xl bg-white/90 dark:bg-[#0a1e2b]/80 border border-[#00aae1]/20 dark:border-[#06b6d4]/20 space-y-2 shadow-sm">
                                    <h4 className="text-sm font-bold text-[#04354d] dark:text-[#fafafa] flex items-center gap-2">
                                        <span className="text-[#00aae1]">📋</span> {language === 'es' ? 'Cuestionario General' : 'General Questionnaire'}
                                    </h4>
                                    <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
                                        {language === 'es'
                                            ? 'Los cuestionarios generales están diseñados para evaluaciones tradicionales y lineales, donde se calcula un único puntaje final acumulativo.'
                                            : 'General questionnaires are designed for traditional, linear evaluations where a single final cumulative score is calculated.'}
                                    </p>
                                    <div className="text-[11px] text-slate-705 dark:text-slate-300 bg-[#effaff]/90 dark:bg-[#05141e]/90 p-3 rounded-lg space-y-1.5 border border-[#00aae1]/10 dark:border-[#06b6d4]/10">
                                        <div><span className="text-[#ff7a39] dark:text-[#ffa36c] font-bold">{language === 'es' ? 'Mecanismo de Cálculo:' : 'Calculation Mechanism:'}</span> {language === 'es' ? 'Suma directa de los puntajes configurados en cada una de las opciones seleccionadas (en preguntas de selección) o parejas correctas (en preguntas asociativas).' : 'Direct sum of the scores configured for each of the selected choices (in selection questions) or correct pairs (in matching questions).'}</div>
                                        <div><span className="text-[#ff7a39] dark:text-[#ffa36c] font-bold">{language === 'es' ? 'Interpretación:' : 'Interpretation:'}</span> {language === 'es' ? 'El puntaje acumulado total se compara directamente contra los rangos de interpretación definidos a nivel de cuestionario en la tabla TKR_RANGOS_INTERPRETACION (ej. 0-10 puntos: Riesgo Bajo).' : 'The total accumulated score is compared directly against the interpretation ranges defined at the questionnaire level in the TKR_RANGOS_INTERPRETACION table (e.g., 0-10 points: Low Risk).'}</div>
                                    </div>
                                </div>

                                {/* Explicación Clínico */}
                                <div className="p-4 rounded-xl bg-white/90 dark:bg-[#0a1e2b]/80 border border-[#00aae1]/20 dark:border-[#06b6d4]/20 space-y-2 shadow-sm">
                                    <h4 className="text-sm font-bold text-[#8b5cf6] flex items-center gap-2">
                                        <span className="text-[#8b5cf6]">🧠</span> {language === 'es' ? 'Cuestionario Clínico (Salud Mental)' : 'Clinical Questionnaire (Mental Health)'}
                                    </h4>
                                    <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
                                        {language === 'es'
                                            ? 'Cuestionarios diseñados para evaluaciones psicológicas y psiquiátricas complejas. Permiten evaluar múltiples dimensiones clínicas (como depresión, ansiedad, etc.) de forma simultánea.'
                                            : 'Questionnaires designed for complex psychological and psychiatric evaluations. They allow evaluating multiple clinical dimensions (such as depression, anxiety, etc.) simultaneously.'}
                                    </p>
                                    <div className="text-[11px] text-slate-705 dark:text-slate-300 bg-[#effaff]/90 dark:bg-[#05141e]/90 p-3 rounded-lg space-y-2 border border-[#8b5cf6]/20 dark:border-[#8b5cf6]/20">
                                        <div>
                                            <span className="text-[#8b5cf6] font-bold">{language === 'es' ? '1. Variables Calculadas (Dimensiones):' : '1. Calculated Variables (Dimensions):'}</span>{' '}
                                            {language === 'es'
                                                ? 'Permiten agrupar un subconjunto de preguntas que miden un aspect específico (ej. Ansiedad). Se almacenan en la tabla TKR_VARIABLES_CALCULADAS.'
                                                : 'Allow grouping a subset of questions that measure a specific aspect (e.g., Anxiety). They are stored in the TKR_VARIABLES_CALCULADAS table.'}
                                        </div>
                                        <div>
                                            <span className="text-[#8b5cf6] font-bold">{language === 'es' ? '2. Ponderación por Pesos (TKR_VARIABLES_CALCULADAS_DET):' : '2. Weight-based Ponderation (TKR_VARIABLES_CALCULADAS_DET):'}</span>{' '}
                                            {language === 'es'
                                                ? 'Cada pregunta asociada a una dimensión clínica puede tener un "peso" específico (ej. peso 1.5 o peso -1 para preguntas invertidas). La puntuación de la pregunta se multiplica por este peso antes de acumularse.'
                                                : 'Each question associated with a clinical dimension can have a specific "weight" (e.g., weight 1.5 or weight -1 for reverse-scored questions). The question score is multiplied by this weight before accumulating.'}
                                        </div>
                                        <div>
                                            <span className="text-[#8b5cf6] font-bold">{language === 'es' ? '3. Rangos de Interpretación Independientes (TKR_RANGOS_INTERPRETACION):' : '3. Independent Interpretation Ranges (TKR_RANGOS_INTERPRETACION):'}</span>{' '}
                                            {language === 'es'
                                                ? 'A diferencia del general, cada dimensión o variable clínica tiene sus propios límites mínimo y máximo y sus propias etiquetas de severidad (ej. Ansiedad Leve de 0-5, Ansiedad Severa de 15-20), independientes de las otras variables del mismo cuestionario.'
                                                : 'Unlike the general one, each dimension or clinical variable has its own minimum and maximum limits and its own severity labels (e.g., Mild Anxiety 0-5, Severe Anxiety 15-20), independent of other variables in the same questionnaire.'}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeHelpTab === 'presentacion' && (
                            <div className="space-y-6">
                                {/* Pregunta por Pregunta */}
                                <div className="p-4 rounded-xl bg-white/90 dark:bg-[#0a1e2b]/80 border border-[#00aae1]/20 dark:border-[#06b6d4]/20 space-y-2 shadow-sm">
                                    <h4 className="text-sm font-bold text-[#04354d] dark:text-[#fafafa] flex items-center gap-2">
                                        <span className="text-[#00aae1]">📄</span> {language === 'es' ? 'Pregunta por Pregunta (Secuencial)' : 'Question by Question (Sequential)'}
                                    </h4>
                                    <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
                                        {language === 'es'
                                            ? 'El cuestionario se presenta de forma secuencial: una pregunta (o sección) a la vez. El usuario navega con botones de Anterior/Siguiente y solo visualiza la pregunta activa. Esta configuración es compatible con flujos condicionales.'
                                            : 'The questionnaire is presented sequentially: one question (or section) at a time. The user navigates using Previous/Next buttons and only sees the active question. This layout is compatible with logical flows.'}
                                    </p>
                                    <div className="text-[11px] text-slate-705 dark:text-slate-300 bg-[#effaff]/90 dark:bg-[#05141e]/90 p-3 rounded-lg space-y-1.5 border border-[#00aae1]/10 dark:border-[#06b6d4]/10">
                                        <div><span className="text-[#ff7a39] dark:text-[#ffa36c] font-bold">{language === 'es' ? 'Cuándo usar:' : 'When to use:'}</span> {language === 'es' ? 'Cuestionarios largos, evaluaciones complejas con saltos condicionales, o cuando se desea una experiencia de usuario guiada paso a paso.' : 'Long questionnaires, complex assessments with logic jumps, or when a step-by-step guided user experience is preferred.'}</div>
                                        <div><span className="text-[#ff7a39] dark:text-[#ffa36c] font-bold">{language === 'es' ? 'Base de Datos:' : 'Database:'}</span> {language === 'es' ? 'Columna PRESENTACION_UNICA = 0 (Valor por defecto).' : 'PRESENTACION_UNICA column = 0 (Default value).'}</div>
                                    </div>
                                </div>

                                {/* Una sola Página */}
                                <div className="p-4 rounded-xl bg-white/90 dark:bg-[#0a1e2b]/80 border border-[#00aae1]/20 dark:border-[#06b6d4]/20 space-y-2 shadow-sm">
                                    <h4 className="text-sm font-bold text-[#01ae6c] flex items-center gap-2">
                                        <span className="text-[#01ae6c]">📃</span> {language === 'es' ? 'Una sola Página (Scroll continuo)' : 'Single Page (Continuous Scroll)'}
                                    </h4>
                                    <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
                                        {language === 'es'
                                            ? 'Todas las preguntas se muestran simultáneamente en una sola página con desplazamiento vertical. El usuario puede ver y responder las preguntas en cualquier orden antes de enviar sus respuestas.'
                                            : 'All questions are displayed simultaneously on a single page with vertical scrolling. The user can view and answer questions in any order before submitting their responses.'}
                                    </p>
                                    <div className="text-[11px] text-slate-705 dark:text-slate-300 bg-[#effaff]/90 dark:bg-[#05141e]/90 p-3 rounded-lg space-y-1.5 border border-[#01ae6c]/15 dark:border-[#01ae6c]/15">
                                        <div><span className="text-[#ff7a39] dark:text-[#ffa36c] font-bold">{language === 'es' ? 'Cuándo usar:' : 'When to use:'}</span> {language === 'es' ? 'Cuestionarios cortos, formularios demográficos simples o cuando no se requieren saltos condicionales entre preguntas.' : 'Short questionnaires, simple demographic forms, or when logic jumps between questions are not required.'}</div>
                                        <div><span className="text-[#ff7a39] dark:text-[#ffa36c] font-bold">{language === 'es' ? 'Nota sobre Flujos Lógicos:' : 'Note on Logical Flows:'}</span> {language === 'es' ? 'En este modo, los flujos condicionales NO se aplican ya que todas las preguntas deben estar visibles en pantalla.' : 'In this mode, logical flows are NOT applied since all questions must be visible on screen.'}</div>
                                        <div><span className="text-[#ff7a39] dark:text-[#ffa36c] font-bold">{language === 'es' ? 'Validación de obligatoriedad:' : 'Required validation:'}</span> {language === 'es' ? 'Al presionar "Finalizar", el sistema valida que todas las preguntas obligatorias tengan respuesta. Si falta alguna, el sistema detiene el envío y realiza un scroll automático a la primera pregunta vacía.' : 'Upon clicking "Finalize", the system validates that all required questions have answers. If any is missing, submission is halted and it automatically scrolls to the first unanswered question.'}</div>
                                        <div><span className="text-[#ff7a39] dark:text-[#ffa36c] font-bold">{language === 'es' ? 'Base de Datos:' : 'Database:'}</span> {language === 'es' ? 'Columna PRESENTACION_UNICA = 1.' : 'PRESENTACION_UNICA column = 1.'}</div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-[#00aae1]/20 dark:border-[#06b6d4]/20 bg-[#effaff]/50 dark:bg-[#040e16]/80 flex justify-between items-center w-full">
                        <button
                            onClick={handleExportUserGuideHTML}
                            className="px-4 py-2 rounded-xl border border-[#00aae1] text-[#00aae1] hover:bg-[#00aae1]/10 text-xs font-bold uppercase tracking-wider transition-all"
                        >
                            📥 {language === 'es' ? 'Exportar HTML' : 'Export HTML'}
                        </button>
                        <button
                            onClick={() => setShowHelpModal(false)}
                            className="px-5 py-2 rounded-xl bg-[#ff7a39] hover:bg-[#e06020] text-slate-50 font-bold text-xs uppercase tracking-wider transition-all"
                        >
                            {language === 'es' ? 'Entendido' : 'Got it'}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Modal de Ayuda al Programador */}
        {showDevHelpModal && (
            <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
                <div className="w-full max-w-6xl h-[85vh] glass-panel border-[#00aae1]/30 dark:border-[#06b6d4]/30 flex flex-col shadow-2xl overflow-hidden animate-scale-up bg-[#effaff]/98 dark:bg-[#071724]/98">
                    {/* Header */}
                    <div className="p-5 border-b border-[#00aae1]/20 dark:border-[#06b6d4]/20 flex justify-between items-center bg-[#effaff]/50 dark:bg-[#040e16]/80">
                        <div className="flex items-center gap-2">
                            <span className="text-xl">💻</span>
                            <h3 className="text-base font-bold text-[#04354d] dark:text-[#fafafa]">
                                {language === 'es' ? 'Documentación de Base de Datos (PKGLN_CUESTIONARIOS)' : 'Database Documentation (PKGLN_CUESTIONARIOS)'}
                            </h3>
                        </div>
                        <button
                            onClick={() => setShowDevHelpModal(false)}
                            className="text-slate-600 dark:text-slate-400 hover:text-red-500 text-lg font-bold p-1 hover:bg-white/10 rounded-lg transition-all"
                        >
                            ✕
                        </button>
                    </div>

                    {/* Split Panel */}
                    <div className="flex-1 flex overflow-hidden">
                        {/* Left Side: Sidebar of procedures */}
                        <div className="w-80 border-r border-[#00aae1]/20 dark:border-[#06b6d4]/20 bg-[#effaff]/50 dark:bg-[#040e16]/80 overflow-y-auto p-4 space-y-1.5 flex flex-col">
                            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-600 dark:text-slate-400 px-2.5 mb-2 block">
                                {language === 'es' ? 'Procedimientos PL/SQL' : 'PL/SQL Procedures'}
                            </span>
                            {Object.keys(plsqlDocs).map((key) => {
                                const doc = plsqlDocs[key];
                                return (
                                    <button
                                        key={key}
                                        onClick={() => setActiveDevTab(key)}
                                        className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-mono font-bold transition-all truncate ${
                                            activeDevTab === key
                                                ? 'bg-[#00aae1] text-slate-50 shadow-md'
                                                : 'hover:bg-[#00aae1]/10 dark:hover:bg-[#06b6d4]/10 text-slate-700 dark:text-slate-350 hover:text-[#00aae1] dark:hover:text-[#06b6d4]'
                                        }`}
                                    >
                                        {key}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Right Side: Details panel */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {(() => {
                                const doc = plsqlDocs[activeDevTab];
                                if (!doc) return null;
                                return (
                                    <div className="space-y-6 p-6 rounded-xl bg-white/90 dark:bg-[#0a1e2b]/80 border border-[#00aae1]/20 dark:border-[#06b6d4]/20 shadow-sm">
                                        <div>
                                            <h4 className="text-lg font-mono font-bold text-[#04354d] dark:text-[#fafafa]">
                                                {doc.name}
                                            </h4>
                                            <p className="text-xs text-slate-700 dark:text-slate-200 mt-1 leading-relaxed font-medium">
                                                {language === 'es' ? doc.descEs : doc.descEn}
                                            </p>
                                        </div>

                                        {/* Params section */}
                                        <div className="space-y-2">
                                            <h5 className="text-xs font-extrabold uppercase tracking-wider text-slate-650 dark:text-slate-400">
                                                {language === 'es' ? 'Parámetros del JSON de Entrada' : 'Input JSON Parameters'}
                                            </h5>
                                            {doc.params.length > 0 ? (
                                                <div className="overflow-x-auto border border-[#00aae1]/25 dark:border-[#06b6d4]/20 rounded-xl bg-[#effaff]/90 dark:bg-[#05141e]/90 p-3.5 border border-[#00aae1]/10 dark:border-[#06b6d4]/10 shadow-inner">
                                                    <table className="min-w-full divide-y divide-[#00aae1]/20 dark:divide-[#06b6d4]/20">
                                                        <thead>
                                                            <tr className="text-left text-[10px] font-bold text-slate-750 dark:text-slate-300 uppercase tracking-widest border-b border-[#00aae1]/25 dark:border-[#06b6d4]/20">
                                                                <th className="py-2 px-3">{language === 'es' ? 'Campo' : 'Field'}</th>
                                                                <th className="py-2 px-3">{language === 'es' ? 'Tipo' : 'Type'}</th>
                                                                <th className="py-2 px-3">{language === 'es' ? 'Requerido' : 'Required'}</th>
                                                                <th className="py-2 px-3">{language === 'es' ? 'Descripción' : 'Description'}</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-[#00aae1]/10 dark:divide-[#06b6d4]/10 text-xs text-slate-700 dark:text-slate-300">
                                                            {doc.params.map((p, idx) => (
                                                                <tr key={idx} className="hover:bg-[#00aae1]/5 dark:hover:bg-[#06b6d4]/10">
                                                                    <td className="py-2.5 px-3 font-mono font-bold text-[#ff7a39] dark:text-[#ffa36c]">{p.name}</td>
                                                                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 font-semibold">{p.type}</td>
                                                                    <td className="py-2.5 px-3">
                                                                        <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-extrabold ${p.required ? 'bg-red-500/10 text-red-500' : 'bg-slate-500/10 text-slate-600 dark:text-slate-300'}`}>
                                                                            {p.required ? (language === 'es' ? 'Sí' : 'Yes') : (language === 'es' ? 'No' : 'No')}
                                                                        </span>
                                                                    </td>
                                                                    <td className="py-2.5 px-3 leading-relaxed font-medium">{language === 'es' ? p.descEs : p.descEn}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            ) : (
                                                <p className="text-xs text-slate-505 dark:text-slate-400 italic">
                                                    {language === 'es' ? 'No requiere parámetros en el JSON de entrada.' : 'No parameters required in the input JSON.'}
                                                </p>
                                            )}
                                        </div>

                                        {/* Output section */}
                                        <div className="space-y-1">
                                            <h5 className="text-xs font-extrabold uppercase tracking-wider text-slate-650 dark:text-slate-400">
                                                {language === 'es' ? 'Salida CLOB' : 'CLOB Output'}
                                            </h5>
                                            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                                                {language === 'es' ? doc.outputEs : doc.outputEn}
                                            </p>
                                        </div>

                                        {/* Code Editor block (VS Code / Monaco styling) */}
                                        <div className="space-y-2">
                                            <h5 className="text-xs font-extrabold uppercase tracking-wider text-slate-650 dark:text-slate-400">
                                                {language === 'es' ? 'Ejemplo de llamado PL/SQL' : 'PL/SQL Invocation Example'}
                                            </h5>
                                            <div className="relative border border-[#06b6d4]/30 dark:border-[#06b6d4]/40 bg-[#1e1e1e] rounded-xl overflow-hidden shadow-lg">
                                                <div className="flex justify-between items-center bg-[#252526] px-4 py-2 border-b border-[#06b6d4]/20">
                                                    <span className="text-[10px] font-mono text-slate-450 font-bold uppercase tracking-wider">Monaco Editor - PL/SQL</span>
                                                    <button
                                                        onClick={() => handleCopy(activeDevTab, doc.code)}
                                                        className="px-2.5 py-1 text-[10px] font-extrabold uppercase rounded bg-[#00aae1] hover:bg-[#008dbb] text-slate-50 transition-all active:scale-[0.98]"
                                                    >
                                                        {copiedId === activeDevTab ? (language === 'es' ? '✓ Copiado' : '✓ Copied') : (language === 'es' ? '📋 Copiar' : '📋 Copy')}
                                                    </button>
                                                </div>
                                                <div className="p-4 overflow-x-auto max-h-80 select-text">
                                                    {highlightPLSQL(doc.code)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="p-4 border-t border-[#00aae1]/20 dark:border-[#06b6d4]/20 bg-[#effaff]/50 dark:bg-[#040e16]/80 flex justify-between items-center w-full">
                        <button
                            onClick={handleExportDevHelpHTML}
                            className="px-4 py-2 rounded-xl border border-[#00aae1] text-[#00aae1] hover:bg-[#00aae1]/10 text-xs font-bold uppercase tracking-wider transition-all"
                        >
                            📥 {language === 'es' ? 'Exportar HTML' : 'Export HTML'}
                        </button>
                        <button
                            onClick={() => setShowDevHelpModal(false)}
                            className="px-5 py-2 rounded-xl bg-[#ff7a39] hover:bg-[#e06020] text-slate-50 font-bold text-xs uppercase tracking-wider transition-all"
                        >
                            {language === 'es' ? 'Cerrar' : 'Close'}
                        </button>
                    </div>
                </div>
            </div>
        )}

        </div>
    );
}

