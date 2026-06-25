'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useCuestionariosContext } from '@/context/CuestionariosContext';

export default function Dashboard() {
    const { 
        initialized, alert, confirm, prompt, user, logout, t, language, setLanguage, theme, toggleTheme,
        fetchCuestionarios, cuestionarios, changeEstadoCuestionario, duplicateCuestionario, saveCuestionario, fetchDashboardStats,
        fetchCuestionarioDetalle
    } = useCuestionariosContext();
    const router = useRouter();

    const [metrics, setMetrics] = useState({
        total_cuestionarios: 0,
        total_preguntas: 0,
        count_unica: 0,
        count_multiple: 0,
        count_abierta: 0,
        count_asociativa: 0
    });
    const [breakdown, setBreakdown] = useState([]);
    const [loadingStats, setLoadingStats] = useState(true);

    // Modal state for creating questionnaire
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newNombre, setNewNombre] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [createError, setCreateError] = useState('');
    const [newTipo, setNewTipo] = useState(1);
    const [distribucionClasif, setDistribucionClasif] = useState([]);
    const [distribucionRiesgo, setDistribucionRiesgo] = useState([]);

    // Modal state for blank print
    const [printBlankItem, setPrintBlankItem] = useState(null); // { id, nombre }

    // Developer help modal states (Ctrl+Alt+D)
    const [showDevHelpModal, setShowDevHelpModal] = useState(false);
    const [activeDevTab, setActiveDevTab] = useState('tkr_cuestionarios');
    const [copiedId, setCopiedId] = useState(null);

    // Dashboard database tables and queries documentation
    const dashboardDocs = useMemo(() => {
        return {
            tkr_cuestionarios: {
                type: 'table',
                name: 'TKR_CUESTIONARIOS',
                descEs: 'Almacena la cabecera y metadatos de los cuestionarios creados en el sistema.',
                descEn: 'Stores the header and metadata of the questionnaires created in the system.',
                columns: [
                    { name: 'id', type: 'NUMBER (PK)', required: true, descEs: 'Identificador único autoincremental.', descEn: 'Unique autoincrement identifier.' },
                    { name: 'nombre', type: 'VARCHAR2(500)', required: true, descEs: 'Nombre o título del cuestionario.', descEn: 'Name or title of the questionnaire.' },
                    { name: 'descripcion', type: 'CLOB', required: false, descEs: 'Descripción detallada o instrucciones generales del cuestionario.', descEn: 'Detailed description or general instructions.' },
                    { name: 'version', type: 'NUMBER', required: false, descEs: 'Número de versión secuencial del cuestionario.', descEn: 'Sequential version number of the questionnaire.' },
                    { name: 'publicado', type: 'NUMBER(1)', required: false, descEs: 'Indicador de publicación (1 = Publicado y disponible, 0 = Borrador).', descEn: 'Publication indicator (1 = Published, 0 = Draft).' },
                    { name: 'fecha_creacion', type: 'DATE', required: false, descEs: 'Fecha y hora de creación del cuestionario.', descEn: 'Creation date and time of the questionnaire.' },
                    { name: 'fecha_publicacion', type: 'DATE', required: false, descEs: 'Fecha de la última publicación del cuestionario.', descEn: 'Date of the last publication.' },
                    { name: 'estado', type: 'NUMBER(1)', required: false, descEs: 'Estado lógico del registro (1 = Activo, 0 = Eliminado/Inactivo).', descEn: 'Logical status (1 = Active, 0 = Deleted/Inactive).' },
                    { name: 'id_tipo_cuestionario', type: 'NUMBER (FK)', required: false, descEs: 'ID del tipo de cuestionario en TKR_TIPOS_CUESTIONARIO (ej. GENERAL, SALUD_MENTAL). Habilita configuraciones específicas por tipo clínico.', descEn: 'ID of the questionnaire type in TKR_TIPOS_CUESTIONARIO (e.g. GENERAL, SALUD_MENTAL). Enables type-specific clinical configurations.' },
                    { name: 'presentacion_unica', type: 'NUMBER(1)', required: true, descEs: 'Define la presentación al diligenciar: 1 = Todas las preguntas en una sola página con scroll continuo. 0 = Secuencial, una pregunta o sección a la vez (default).', descEn: 'Defines layout when filling out: 1 = All questions on one scrollable page. 0 = Sequential, one question/section at a time (default).' }
                ]
            },
            tkr_tipos_cuestionario: {
                type: 'table',
                name: 'TKR_TIPOS_CUESTIONARIO',
                descEs: 'Catálogo maestro de clasificación de tipos de cuestionario. Permite activar flujos clínicos, variables y configuraciones específicas según el tipo (ej. GENERAL, SALUD_MENTAL, MEDICINA, RIESGO).',
                descEn: 'Master catalog for questionnaire type classification. Enables clinical flows, variables, and specific configurations per type (e.g. GENERAL, SALUD_MENTAL, MEDICINA, RIESGO).',
                columns: [
                    { name: 'id', type: 'NUMBER (PK)', required: true, descEs: 'Identificador único del tipo de cuestionario.', descEn: 'Unique type identifier.' },
                    { name: 'codigo', type: 'VARCHAR2(100)', required: true, descEs: 'Código único de identificación del tipo (ej. GENERAL, SALUD_MENTAL, MEDICINA, RIESGO).', descEn: 'Unique type code (e.g. GENERAL, SALUD_MENTAL, MEDICINA, RIESGO).' },
                    { name: 'nombre', type: 'VARCHAR2(200)', required: true, descEs: 'Nombre descriptivo o etiqueta del tipo de cuestionario.', descEn: 'Descriptive name or label for the questionnaire type.' },
                    { name: 'descripcion', type: 'VARCHAR2(1000)', required: false, descEs: 'Descripción clínica de la finalidad y alcance de este tipo.', descEn: 'Clinical description of the purpose and scope of this type.' },
                    { name: 'estado', type: 'NUMBER(1)', required: true, descEs: 'Estado lógico (1 = Activo, 0 = Inactivo). Default: 1.', descEn: 'Logical status (1 = Active, 0 = Inactive). Default: 1.' }
                ]
            },
            tkr_secciones_cuestionario: {
                type: 'table',
                name: 'TKR_SECCIONES_CUESTIONARIO',
                descEs: 'Define las secciones, páginas o categorías que agrupan preguntas dentro de un cuestionario. En modo secuencial, cada sección representa una pantalla independiente.',
                descEn: 'Defines the sections, pages, or categories grouping questions within a questionnaire. In sequential mode, each section represents an independent screen.',
                columns: [
                    { name: 'id', type: 'NUMBER (PK)', required: true, descEs: 'Identificador único de la sección.', descEn: 'Unique section identifier.' },
                    { name: 'id_cuestionario', type: 'NUMBER (FK)', required: true, descEs: 'ID del cuestionario asociado en TKR_CUESTIONARIOS.', descEn: 'ID of the associated questionnaire in TKR_CUESTIONARIOS.' },
                    { name: 'nombre', type: 'VARCHAR2(300)', required: false, descEs: 'Nombre visible de la sección (ej. "Datos Generales", "Síntomas").', descEn: 'Visible name of the section (e.g. "General Data", "Symptoms").' },
                    { name: 'descripcion', type: 'VARCHAR2(1000)', required: false, descEs: 'Instrucciones o descripción breve de la sección mostrada al diligenciador.', descEn: 'Short description or instructions shown to the respondent.' },
                    { name: 'orden_visual', type: 'NUMBER', required: false, descEs: 'Orden secuencial de renderizado en el cuestionario (ascendente).', descEn: 'Sequential rendering order in the questionnaire (ascending).' },
                    { name: 'estado', type: 'NUMBER(1)', required: false, descEs: 'Estado lógico (1 = Activo, 0 = Eliminado).', descEn: 'Logical status (1 = Active, 0 = Deleted).' }
                ]
            },
            tkr_preguntas: {
                type: 'table',
                name: 'TKR_PREGUNTAS',
                descEs: 'Catálogo de preguntas asociadas a los cuestionarios y sus secciones. Soporta múltiples tipos: ABIERTA, UNICA, MULTIPLE, NUMERICA, FECHA, ASOCIATIVA.',
                descEn: 'Catalog of questions associated with questionnaires and their sections. Supports multiple types: ABIERTA, UNICA, MULTIPLE, NUMERICA, FECHA, ASOCIATIVA.',
                columns: [
                    { name: 'id', type: 'NUMBER (PK)', required: true, descEs: 'Identificador único de la pregunta.', descEn: 'Unique question identifier.' },
                    { name: 'id_cuestionario', type: 'NUMBER (FK)', required: true, descEs: 'ID del cuestionario al que pertenece.', descEn: 'ID of the questionnaire it belongs to.' },
                    { name: 'id_seccion_cuestionario', type: 'NUMBER (FK)', required: false, descEs: 'ID de la sección donde se agrupa (si aplica).', descEn: 'ID of the grouping section (if applicable).' },
                    { name: 'id_tipo_pregunta', type: 'NUMBER (FK)', required: true, descEs: 'ID del tipo de pregunta (ABIERTA, UNICA, MULTIPLE, NUMERICA, FECHA, ASOCIATIVA).', descEn: 'ID of the question type (ABIERTA, UNICA, MULTIPLE, NUMERICA, FECHA, ASOCIATIVA).' },
                    { name: 'codigo', type: 'VARCHAR2(100)', required: false, descEs: 'Código visual corto de la pregunta (ej. P1, P2). Usado en variables calculadas y flujos.', descEn: 'Short visual code of the question (e.g. P1, P2). Used in calculated variables and flows.' },
                    { name: 'texto_pregunta', type: 'CLOB', required: false, descEs: 'Texto o enunciado completo de la pregunta tal como aparece al diligenciador.', descEn: 'Full text or prompt of the question as shown to the respondent.' },
                    { name: 'orden_visual', type: 'NUMBER', required: false, descEs: 'Orden secuencial de aparición dentro de la sección.', descEn: 'Sequential display order within the section.' },
                    { name: 'obligatoria', type: 'NUMBER(1)', required: false, descEs: 'Indica si responder es obligatorio (1 = Sí, 0 = No). Las obligatorias bloquean el avance o envío.', descEn: 'Indicates if answering is mandatory (1 = Yes, 0 = No). Mandatory ones block progress or submission.' },
                    { name: 'valor_pregunta', type: 'NUMBER', required: false, descEs: 'Puntaje base de la pregunta para cálculos de puntaje global.', descEn: 'Base score of the question for global score calculations.' },
                    { name: 'permite_otro', type: 'NUMBER(1)', required: false, descEs: 'Permite opción de texto libre "Otro" en preguntas UNICA o MULTIPLE (1 = Sí, 0 = No).', descEn: 'Allows free-text "Other" option in UNICA or MULTIPLE questions (1 = Yes, 0 = No).' },
                    { name: 'estado', type: 'NUMBER(1)', required: false, descEs: 'Estado lógico (1 = Activo, 0 = Eliminado).', descEn: 'Logical status (1 = Active, 0 = Deleted).' }
                ]
            },
            tkr_opciones_pregunta: {
                type: 'table',
                name: 'TKR_OPCIONES_PREGUNTA',
                descEs: 'Opciones de respuesta predefinidas para preguntas de tipo UNICA o MULTIPLE. Cada opción puede tener un valor numérico que contribuye al puntaje final.',
                descEn: 'Predefined answer choices for UNICA or MULTIPLE type questions. Each option can have a numeric value contributing to the final score.',
                columns: [
                    { name: 'id', type: 'NUMBER (PK)', required: true, descEs: 'Identificador único de la opción de respuesta.', descEn: 'Unique answer option identifier.' },
                    { name: 'id_pregunta', type: 'NUMBER (FK)', required: true, descEs: 'ID de la pregunta a la que pertenece esta opción.', descEn: 'ID of the question this option belongs to.' },
                    { name: 'texto_opcion', type: 'VARCHAR2(4000)', required: false, descEs: 'Texto visible de la opción mostrado al diligenciador.', descEn: 'Visible option text shown to the respondent.' },
                    { name: 'codigo_opcion', type: 'VARCHAR2(100)', required: false, descEs: 'Código identificador único de la opción (ej. OP1, OP2).', descEn: 'Unique identifier code of the option (e.g. OP1, OP2).' },
                    { name: 'orden_visual', type: 'NUMBER', required: false, descEs: 'Posición de renderizado en la lista de opciones.', descEn: 'Rendering position in the options list.' },
                    { name: 'valor_opcion', type: 'NUMBER', required: false, descEs: 'Puntaje acumulativo asignado al seleccionar esta opción (puede ser negativo).', descEn: 'Cumulative score assigned when choosing this option (can be negative).' },
                    { name: 'estado', type: 'NUMBER(1)', required: false, descEs: 'Estado lógico (1 = Activo, 0 = Eliminado).', descEn: 'Logical status (1 = Active, 0 = Deleted).' }
                ]
            },
            tkr_pregunta_asociativa: {
                type: 'table',
                name: 'TKR_PREGUNTA_ASOCIATIVA',
                descEs: 'Define los pares de emparejamiento para preguntas de tipo ASOCIATIVA (matching). Cada fila es un par Columna A → Columna B que el usuario debe relacionar.',
                descEn: 'Defines matching pairs for ASOCIATIVA (matching) type questions. Each row is a Column A → Column B pair the user must relate.',
                columns: [
                    { name: 'id', type: 'NUMBER (PK)', required: true, descEs: 'Identificador único del par de emparejamiento.', descEn: 'Unique matching pair identifier.' },
                    { name: 'id_pregunta', type: 'NUMBER (FK)', required: true, descEs: 'ID de la pregunta de tipo ASOCIATIVA relacionada.', descEn: 'ID of the related ASOCIATIVA type question.' },
                    { name: 'item_izquierdo', type: 'VARCHAR2(1000)', required: false, descEs: 'Elemento de la columna izquierda (Columna A) — el estímulo.', descEn: 'Element of the left column (Column A) — the stimulus.' },
                    { name: 'item_derecho', type: 'VARCHAR2(1000)', required: false, descEs: 'Elemento correspondiente de la columna derecha (Columna B) — la respuesta correcta.', descEn: 'Corresponding element of the right column (Column B) — the correct answer.' },
                    { name: 'valor_correcto', type: 'NUMBER', required: false, descEs: 'Puntaje otorgado cuando se empareja este par correctamente.', descEn: 'Score awarded when this pair is correctly matched.' },
                    { name: 'estado', type: 'NUMBER(1)', required: false, descEs: 'Estado lógico (1 = Activo, 0 = Eliminado).', descEn: 'Logical status (1 = Active, 0 = Deleted).' }
                ]
            },
            tkr_variables_calculadas: {
                type: 'table',
                name: 'TKR_VARIABLES_CALCULADAS',
                descEs: 'Define las variables clínicas, sub-escalas o dimensiones de puntuación de un cuestionario (ej. DEPRESION_TOTAL, ANSIEDAD_TOTAL). Cada variable agrega los valores de un subconjunto de preguntas definido en TKR_VARIABLES_CALCULADAS_DET.',
                descEn: 'Defines clinical variables, sub-scales, or scoring dimensions for a questionnaire (e.g. DEPRESION_TOTAL, ANSIEDAD_TOTAL). Each variable aggregates values from a subset of questions defined in TKR_VARIABLES_CALCULADAS_DET.',
                columns: [
                    { name: 'id', type: 'NUMBER (PK)', required: true, descEs: 'Identificador único de la variable calculada.', descEn: 'Unique calculated variable identifier.' },
                    { name: 'id_cuestionario', type: 'NUMBER (FK)', required: true, descEs: 'ID del cuestionario al que pertenece esta variable.', descEn: 'ID of the questionnaire this variable belongs to.' },
                    { name: 'codigo', type: 'VARCHAR2(100)', required: true, descEs: 'Código único de la variable (ej. DEPRESION_TOTAL, RIESGO_SUICIDA). Usado en rangos de interpretación.', descEn: 'Unique variable code (e.g. DEPRESION_TOTAL, RIESGO_SUICIDA). Used in interpretation ranges.' },
                    { name: 'nombre', type: 'VARCHAR2(200)', required: true, descEs: 'Nombre formal o título de la dimensión clínica.', descEn: 'Formal name or title of the clinical dimension.' },
                    { name: 'descripcion', type: 'VARCHAR2(1000)', required: false, descEs: 'Descripción clínica de lo que mide esta variable.', descEn: 'Clinical description of what this variable measures.' },
                    { name: 'formula_calculo', type: 'VARCHAR2(1000)', required: false, descEs: 'Fórmula de agregación matemática aplicada a los pesos (SUM, AVG, MAX, MIN). Default: SUM.', descEn: 'Mathematical aggregation formula applied to weights (SUM, AVG, MAX, MIN). Default: SUM.' },
                    { name: 'valor_minimo', type: 'NUMBER', required: false, descEs: 'Valor teórico mínimo posible de la variable (usado en UI de rangos).', descEn: 'Theoretical minimum value of the variable (used in range UI).' },
                    { name: 'valor_maximo', type: 'NUMBER', required: false, descEs: 'Valor teórico máximo posible de la variable (usado en UI de rangos).', descEn: 'Theoretical maximum value of the variable (used in range UI).' },
                    { name: 'unidad_medida', type: 'VARCHAR2(100)', required: false, descEs: 'Unidad de la variable (ej. puntos, %, nivel).', descEn: 'Unit of the variable (e.g. points, %, level).' },
                    { name: 'orden_visual', type: 'NUMBER', required: true, descEs: 'Posición de ordenamiento en el reporte de resultados clínicos. Default: 1.', descEn: 'Sorting order in the clinical results report. Default: 1.' },
                    { name: 'estado', type: 'NUMBER(1)', required: true, descEs: 'Estado lógico (1 = Activo, 0 = Eliminado). Default: 1.', descEn: 'Logical status (1 = Active, 0 = Deleted). Default: 1.' },
                    { name: 'fecha_creacion', type: 'DATE', required: true, descEs: 'Fecha y hora de creación del registro. Default: SYSDATE.', descEn: 'Creation date and time. Default: SYSDATE.' }
                ]
            },
            tkr_variables_calculadas_det: {
                type: 'table',
                name: 'TKR_VARIABLES_CALCULADAS_DET',
                descEs: 'Detalle asociativo de las preguntas que componen cada variable calculada, con sus respectivos pesos (coeficientes). FK: FK_TKR_VC_DET_PREGUNTA → TKR_PREGUNTAS.',
                descEn: 'Associative detail of the questions composing each calculated variable, with their respective weights (coefficients). FK: FK_TKR_VC_DET_PREGUNTA → TKR_PREGUNTAS.',
                columns: [
                    { name: 'id', type: 'NUMBER (PK)', required: true, descEs: 'Identificador único de la regla de detalle.', descEn: 'Unique detail rule identifier.' },
                    { name: 'id_variable_calculada', type: 'NUMBER (FK)', required: true, descEs: 'ID de la variable cabecera en TKR_VARIABLES_CALCULADAS.', descEn: 'ID of the header variable in TKR_VARIABLES_CALCULADAS.' },
                    { name: 'id_pregunta', type: 'NUMBER (FK)', required: true, descEs: 'ID de la pregunta de TKR_PREGUNTAS cuyo valor se incluye en el cálculo. FK: FK_TKR_VC_DET_PREGUNTA.', descEn: 'ID of the question from TKR_PREGUNTAS whose value is included in the calculation. FK: FK_TKR_VC_DET_PREGUNTA.' },
                    { name: 'peso', type: 'NUMBER', required: true, descEs: 'Ponderador multiplicador aplicado al valor de la respuesta de la pregunta (ej. 1, 1.5, -2). Default: 1.', descEn: 'Multiplier weight applied to the question\'s answer value (e.g. 1, 1.5, -2). Default: 1.' },
                    { name: 'orden_visual', type: 'NUMBER', required: true, descEs: 'Posición de ordenamiento de la pregunta dentro de la variable. Default: 1.', descEn: 'Sorting order of the question within the variable. Default: 1.' },
                    { name: 'estado', type: 'NUMBER(1)', required: true, descEs: 'Estado lógico (1 = Activo, 0 = Eliminado). Default: 1.', descEn: 'Logical status (1 = Active, 0 = Deleted). Default: 1.' }
                ]
            },
            tkr_rangos_interpretacion: {
                type: 'table',
                name: 'TKR_RANGOS_INTERPRETACION',
                descEs: 'Define los rangos de interpretación clínica para las puntuaciones de las variables calculadas de un cuestionario. Permite mapear un puntaje numérico a una clasificación (ej. Depresión Leve, Severa). FK: FK_TKR_RANGOS_INTERP_VAR_CALC → TKR_VARIABLES_CALCULADAS.',
                descEn: 'Defines the clinical interpretation ranges for calculated variable scores in a questionnaire. Maps a numeric score to a classification (e.g. Mild Depression, Severe). FK: FK_TKR_RANGOS_INTERP_VAR_CALC → TKR_VARIABLES_CALCULADAS.',
                columns: [
                    { name: 'id', type: 'NUMBER (PK)', required: true, descEs: 'Identificador único del rango de interpretación.', descEn: 'Unique interpretation range identifier.' },
                    { name: 'id_cuestionario', type: 'NUMBER (FK)', required: true, descEs: 'ID del cuestionario al que pertenece este rango.', descEn: 'ID of the questionnaire this range belongs to.' },
                    { name: 'id_variable_calculada', type: 'NUMBER (FK)', required: false, descEs: 'ID de la variable calculada en TKR_VARIABLES_CALCULADAS (ej. DEPRESION_TOTAL, RIESGO_SUICIDA). Si es NULL, el rango se aplica al puntaje global del cuestionario. FK: FK_TKR_RANGOS_INTERP_VAR_CALC.', descEn: 'ID of the calculated variable in TKR_VARIABLES_CALCULADAS (e.g. DEPRESION_TOTAL). If NULL, range applies to the questionnaire global score. FK: FK_TKR_RANGOS_INTERP_VAR_CALC.' },
                    { name: 'nombre_rango', type: 'VARCHAR2(200)', required: true, descEs: 'Título o etiqueta corta del rango (ej. "Depresión Leve", "Riesgo Alto").', descEn: 'Short title or label of the range (e.g. "Mild Depression", "High Risk").' },
                    { name: 'valor_minimo', type: 'NUMBER', required: true, descEs: 'Límite inferior inclusivo del rango de puntaje.', descEn: 'Inclusive lower bound of the score range.' },
                    { name: 'valor_maximo', type: 'NUMBER', required: true, descEs: 'Límite superior inclusivo del rango de puntaje.', descEn: 'Inclusive upper bound of the score range.' },
                    { name: 'clasificacion', type: 'VARCHAR2(200)', required: true, descEs: 'Clasificación clínica o diagnóstica del rango (ej. Leve, Moderada, Severa).', descEn: 'Clinical or diagnostic classification of the range (e.g. Mild, Moderate, Severe).' },
                    { name: 'descripcion', type: 'VARCHAR2(1000)', required: false, descEs: 'Explicación del significado clínico y recomendaciones para este rango de puntaje.', descEn: 'Explanation of clinical meaning and recommendations for this score range.' },
                    { name: 'color_visual', type: 'VARCHAR2(50)', required: false, descEs: 'Color semántico del badge de resultados (green, orange, red, blue, grey).', descEn: 'Semantic badge color for results (green, orange, red, blue, grey).' },
                    { name: 'orden_visual', type: 'NUMBER', required: true, descEs: 'Posición de ordenamiento para el reporte de resultados. Default: 1.', descEn: 'Sorting position for the results report. Default: 1.' },
                    { name: 'estado', type: 'NUMBER(1)', required: true, descEs: 'Estado lógico (1 = Activo, 0 = Eliminado). Default: 1.', descEn: 'Logical status (1 = Active, 0 = Deleted). Default: 1.' },
                    { name: 'fecha_creacion', type: 'DATE', required: true, descEs: 'Fecha y hora de creación del registro. Default: SYSDATE.', descEn: 'Creation date and time. Default: SYSDATE.' }
                ]
            },
            tkr_resultados_cuestionario: {
                type: 'table',
                name: 'TKR_RESULTADOS_CUESTIONARIO',
                descEs: 'Define resultados globales o descriptivos por rango de puntaje total del cuestionario (diferente a TKR_RANGOS_INTERPRETACION que es por variable). Permite mostrar mensajes o diagnósticos generales al finalizar.',
                descEn: 'Defines global or descriptive results by total questionnaire score range (distinct from TKR_RANGOS_INTERPRETACION which is per variable). Allows showing general messages or diagnoses upon completion.',
                columns: [
                    { name: 'id', type: 'NUMBER (PK)', required: true, descEs: 'Identificador único del resultado.', descEn: 'Unique result identifier.' },
                    { name: 'id_cuestionario', type: 'NUMBER (FK)', required: false, descEs: 'ID del cuestionario al que pertenece este resultado global.', descEn: 'ID of the questionnaire this global result belongs to.' },
                    { name: 'puntaje_desde', type: 'NUMBER', required: false, descEs: 'Puntaje mínimo inclusivo para activar este resultado.', descEn: 'Inclusive minimum score to trigger this result.' },
                    { name: 'puntaje_hasta', type: 'NUMBER', required: false, descEs: 'Puntaje máximo inclusivo para activar este resultado.', descEn: 'Inclusive maximum score to trigger this result.' },
                    { name: 'nombre_resultado', type: 'VARCHAR2(500)', required: false, descEs: 'Etiqueta del resultado (ej. "Riesgo Bajo", "Diagnóstico Positivo").', descEn: 'Result label (e.g. "Low Risk", "Positive Diagnosis").' },
                    { name: 'descripcion', type: 'CLOB', required: false, descEs: 'Descripción detallada, diagnóstico o recomendaciones del resultado.', descEn: 'Detailed description, diagnosis, or recommendations for this result.' },
                    { name: 'color', type: 'VARCHAR2(30)', required: false, descEs: 'Color semántico del resultado para la interfaz visual.', descEn: 'Semantic color for the result in the visual interface.' },
                    { name: 'estado', type: 'NUMBER(1)', required: false, descEs: 'Estado lógico (1 = Activo, 0 = Eliminado).', descEn: 'Logical status (1 = Active, 0 = Deleted).' }
                ]
            },
            tkr_flujos_pregunta: {
                type: 'table',
                name: 'TKR_FLUJOS_PREGUNTA',
                descEs: 'Define las reglas de flujo condicional (branching logic) entre preguntas. Permite saltar a preguntas diferentes según la respuesta del usuario. Cada flujo conecta una pregunta origen con una pregunta destino.',
                descEn: 'Defines conditional flow rules (branching logic) between questions. Allows jumping to different questions based on user responses. Each flow connects a source question to a target question.',
                columns: [
                    { name: 'id', type: 'NUMBER (PK)', required: true, descEs: 'Identificador único del flujo condicional.', descEn: 'Unique conditional flow identifier.' },
                    { name: 'id_pregunta_origen', type: 'NUMBER (FK)', required: true, descEs: 'ID de la pregunta que activa el flujo (la que se evalúa).', descEn: 'ID of the question that triggers the flow (the one being evaluated).' },
                    { name: 'id_opcion_respuesta', type: 'NUMBER (FK)', required: false, descEs: 'ID de la opción de respuesta específica que dispara el flujo (para UNICA/MULTIPLE).', descEn: 'ID of the specific answer option that triggers the flow (for UNICA/MULTIPLE).' },
                    { name: 'id_operador', type: 'NUMBER (FK)', required: false, descEs: 'ID del operador de comparación (=, !=, >, <, etc.) para evaluación de valor.', descEn: 'ID of the comparison operator (=, !=, >, <, etc.) for value evaluation.' },
                    { name: 'valor_comparacion', type: 'VARCHAR2(4000)', required: false, descEs: 'Valor contra el que se compara la respuesta en el operador.', descEn: 'Value to compare against the answer using the operator.' },
                    { name: 'id_pregunta_destino', type: 'NUMBER (FK)', required: true, descEs: 'ID de la pregunta a la que se redirige si se cumple la condición.', descEn: 'ID of the question to redirect to if the condition is met.' },
                    { name: 'prioridad', type: 'NUMBER', required: false, descEs: 'Prioridad de evaluación del flujo (menor número = mayor prioridad).', descEn: 'Evaluation priority of the flow (lower number = higher priority).' },
                    { name: 'estado', type: 'NUMBER(1)', required: false, descEs: 'Estado lógico (1 = Activo, 0 = Eliminado).', descEn: 'Logical status (1 = Active, 0 = Deleted).' }
                ]
            },
            tkr_reglas_flujo: {
                type: 'table',
                name: 'TKR_REGLAS_FLUJO',
                descEs: 'Reglas compuestas adicionales asociadas a un flujo de pregunta. Permite construir condiciones complejas (AND/OR) que deben evaluarse para activar el flujo.',
                descEn: 'Additional compound rules associated with a question flow. Enables building complex (AND/OR) conditions that must be evaluated to activate the flow.',
                columns: [
                    { name: 'id', type: 'NUMBER (PK)', required: true, descEs: 'Identificador único de la regla.', descEn: 'Unique rule identifier.' },
                    { name: 'id_flujo_pregunta', type: 'NUMBER (FK)', required: true, descEs: 'ID del flujo padre en TKR_FLUJOS_PREGUNTA.', descEn: 'ID of the parent flow in TKR_FLUJOS_PREGUNTA.' },
                    { name: 'campo_evaluado', type: 'VARCHAR2(100)', required: false, descEs: 'Campo o variable de la respuesta a evaluar.', descEn: 'Response field or variable to evaluate.' },
                    { name: 'operador', type: 'VARCHAR2(30)', required: false, descEs: 'Operador de comparación (=, !=, >, <, CONTAINS, etc.).', descEn: 'Comparison operator (=, !=, >, <, CONTAINS, etc.).' },
                    { name: 'valor_esperado', type: 'VARCHAR2(4000)', required: false, descEs: 'Valor esperado contra el que se evalúa el campo.', descEn: 'Expected value against which the field is evaluated.' },
                    { name: 'agrupador', type: 'VARCHAR2(10)', required: false, descEs: 'Operador lógico para encadenar con la siguiente regla (AND, OR).', descEn: 'Logical operator to chain with the next rule (AND, OR).' },
                    { name: 'estado', type: 'NUMBER(1)', required: false, descEs: 'Estado lógico (1 = Activo, 0 = Eliminado).', descEn: 'Logical status (1 = Active, 0 = Deleted).' }
                ]
            },
            tkr_cuestionario_respuesta: {
                type: 'table',
                name: 'TKR_CUESTIONARIO_RESPUESTA',
                descEs: 'Cabecera de cada sesión de respuesta o intento de diligenciamiento. Una fila por cada vez que un usuario inicia el cuestionario. Si id_usuario es NULL, es una sesión de previsualización del administrador (se auto-elimina en la siguiente previsualización).',
                descEn: 'Header for each response session or filling attempt. One row per each time a user starts the questionnaire. If id_usuario is NULL, it is an admin preview session (auto-deleted on next preview).',
                columns: [
                    { name: 'id', type: 'NUMBER (PK)', required: true, descEs: 'Identificador único de la sesión de respuestas.', descEn: 'Unique response session identifier.' },
                    { name: 'id_cuestionario', type: 'NUMBER (FK)', required: false, descEs: 'ID del cuestionario respondido en TKR_CUESTIONARIOS.', descEn: 'ID of the answered questionnaire in TKR_CUESTIONARIOS.' },
                    { name: 'id_usuario', type: 'NUMBER', required: false, descEs: 'ID del usuario que completó el cuestionario. NULL indica sesión de previsualización del administrador.', descEn: 'ID of the user who completed the questionnaire. NULL indicates an admin preview session.' },
                    { name: 'fecha_inicio', type: 'DATE', required: false, descEs: 'Fecha y hora exactas de inicio de la sesión de respuesta.', descEn: 'Exact start date and time of the response session.' },
                    { name: 'fecha_fin', type: 'DATE', required: false, descEs: 'Fecha y hora de finalización de la sesión. NULL si sigue en borrador.', descEn: 'End date and time of the session. NULL if still in draft.' },
                    { name: 'puntaje_total', type: 'NUMBER', required: false, descEs: 'Puntaje acumulativo total obtenido al finalizar.', descEn: 'Total cumulative score obtained upon completion.' },
                    { name: 'clasificacion_final', type: 'VARCHAR2(500)', required: false, descEs: 'Categoría final del puntaje mapeada desde TKR_RANGOS_INTERPRETACION (ej. Riesgo Severo).', descEn: 'Final score classification category mapped from TKR_RANGOS_INTERPRETACION (e.g. Severe Risk).' },
                    { name: 'estado', type: 'NUMBER(1)', required: false, descEs: 'Estado de la sesión (0 = En proceso/Borrador, 1 = Finalizado y enviado).', descEn: 'Session state (0 = In progress/Draft, 1 = Completed and submitted).' }
                ]
            },
            tkr_respuestas: {
                type: 'table',
                name: 'TKR_RESPUESTAS',
                descEs: 'Almacena la respuesta individual del usuario para cada pregunta de la sesión. Una fila por pregunta respondida.',
                descEn: 'Stores the individual user response for each question in the session. One row per answered question.',
                columns: [
                    { name: 'id', type: 'NUMBER (PK)', required: true, descEs: 'Identificador único de la respuesta individual.', descEn: 'Unique individual answer identifier.' },
                    { name: 'id_cuestionario_respuesta', type: 'NUMBER (FK)', required: false, descEs: 'ID de la sesión de respuestas en TKR_CUESTIONARIO_RESPUESTA.', descEn: 'ID of the response session in TKR_CUESTIONARIO_RESPUESTA.' },
                    { name: 'id_pregunta', type: 'NUMBER (FK)', required: false, descEs: 'ID de la pregunta respondida en TKR_PREGUNTAS.', descEn: 'ID of the answered question in TKR_PREGUNTAS.' },
                    { name: 'respuesta_texto', type: 'CLOB', required: false, descEs: 'Respuesta en texto libre (ABIERTA), o JSON de mapeo de pares para ASOCIATIVA ({"izq":"der"}).', descEn: 'Free-text answer (ABIERTA), or JSON pair map for ASOCIATIVA ({"left":"right"}).' },
                    { name: 'respuesta_numero', type: 'NUMBER', required: false, descEs: 'Respuesta numérica (para preguntas NUMERICA).', descEn: 'Numeric answer (for NUMERICA type questions).' },
                    { name: 'respuesta_fecha', type: 'DATE', required: false, descEs: 'Respuesta en formato fecha (para preguntas FECHA).', descEn: 'Date-format answer (for FECHA type questions).' },
                    { name: 'valor_obtenido', type: 'NUMBER', required: false, descEs: 'Puntaje individual calculado para esta respuesta.', descEn: 'Individual calculated score for this answer.' },
                    { name: 'estado', type: 'NUMBER(1)', required: false, descEs: 'Estado de la respuesta (1 = Activo).', descEn: 'Answer status (1 = Active).' }
                ]
            },
            tkr_respuesta_opciones: {
                type: 'table',
                name: 'TKR_RESPUESTA_OPCIONES',
                descEs: 'Detalle de las opciones seleccionadas en preguntas UNICA o MULTIPLE. Una fila por cada opción marcada. Se usa junto con TKR_RESPUESTAS.',
                descEn: 'Details of the options selected in UNICA or MULTIPLE questions. One row per selected option. Used together with TKR_RESPUESTAS.',
                columns: [
                    { name: 'id', type: 'NUMBER (PK)', required: true, descEs: 'Identificador único de la fila de opción seleccionada.', descEn: 'Unique selected option row identifier.' },
                    { name: 'id_respuesta', type: 'NUMBER (FK)', required: false, descEs: 'ID de la respuesta cabecera en TKR_RESPUESTAS.', descEn: 'ID of the header answer in TKR_RESPUESTAS.' },
                    { name: 'id_opcion_pregunta', type: 'NUMBER (FK)', required: false, descEs: 'ID de la opción seleccionada en TKR_OPCIONES_PREGUNTA.', descEn: 'ID of the selected option in TKR_OPCIONES_PREGUNTA.' },
                    { name: 'valor_obtenido', type: 'NUMBER', required: false, descEs: 'Puntaje sumado por esta opción específica seleccionada.', descEn: 'Score added by this specific selected option.' },
                    { name: 'estado', type: 'NUMBER(1)', required: false, descEs: 'Estado de la fila (1 = Activo).', descEn: 'Row status (1 = Active).' }
                ]
            },
            sql_metricas_dashboard: {
                type: 'sql',
                name: 'Métricas del Dashboard',
                descEs: 'Consultas agregadas que calculan los valores globales mostrados en las 6 tarjetas de métricas en la parte superior del Dashboard.',
                descEn: 'Aggregate queries that calculate global values displayed in the 6 metric cards at the top of the Dashboard.',
                queries: [
                    {
                        titleEs: '1. Total de Cuestionarios Activos',
                        titleEn: '1. Total Active Questionnaires',
                        descEs: 'Cuenta los cuestionarios no eliminados en el sistema.',
                        descEn: 'Counts non-deleted questionnaires in the system.',
                        code: `-- Total de cuestionarios activos en el sistema
SELECT COUNT(*) AS total_cuestionarios 
FROM tkr_cuestionarios 
WHERE estado = 1;`
                    },
                    {
                        titleEs: '2. Total de Preguntas Activas',
                        titleEn: '2. Total Active Questions',
                        descEs: 'Suma todas las preguntas activas asociadas a cuestionarios activos.',
                        descEn: 'Sums all active questions associated with active questionnaires.',
                        code: `-- Total de preguntas activas
SELECT COUNT(*) AS total_preguntas
FROM tkr_preguntas p
JOIN tkr_cuestionarios c ON p.id_cuestionario = c.id
WHERE p.estado = 1 AND c.estado = 1;`
                    },
                    {
                        titleEs: '3. Cantidad de Preguntas por Tipo',
                        titleEn: '3. Questions Count by Type',
                        descEs: 'Clasifica y cuenta las preguntas activas según su tipo de pregunta (Selección Única: 1, Múltiple: 2, Abierta: 3, Asociativa: 4).',
                        descEn: 'Classifies and counts active questions by their question type (Single Choice: 1, Multiple: 2, Open Text: 3, Matching: 4).',
                        code: `-- Desglose de preguntas por tipo
SELECT 
  COUNT(CASE WHEN p.id_tipo_pregunta = 1 THEN 1 END) AS count_unica,
  COUNT(CASE WHEN p.id_tipo_pregunta = 2 THEN 1 END) AS count_multiple,
  COUNT(CASE WHEN p.id_tipo_pregunta = 3 THEN 1 END) AS count_abierta,
  COUNT(CASE WHEN p.id_tipo_pregunta = 4 THEN 1 END) AS count_asociativa
FROM tkr_preguntas p
JOIN tkr_cuestionarios c ON p.id_cuestionario = c.id
WHERE p.estado = 1 AND c.estado = 1;`
                    },
                    {
                        titleEs: '4. Cuestionarios Clínicos (Salud Mental) Activos',
                        titleEn: '4. Active Clinical Questionnaires (Mental Health)',
                        descEs: 'Cuenta los cuestionarios activos configurados como clínicos de Salud Mental (id_tipo_cuestionario = 2).',
                        descEn: 'Counts active questionnaires configured as clinical of Mental Health (id_tipo_cuestionario = 2).',
                        code: `-- Cuestionarios de salud mental activos
SELECT COUNT(*) AS total_clinicos 
FROM tkr_cuestionarios 
WHERE estado = 1 AND id_tipo_cuestionario = 2;`
                    },
                    {
                        titleEs: '5. Desglose de Respuestas Clínicas por Clasificación',
                        titleEn: '5. Clinical Answers Breakdown by Classification',
                        descEs: 'Agrupa las evaluaciones clínicas completadas según su clasificación final registrada para cuestionarios clínicos.',
                        descEn: 'Groups completed clinical evaluations by their registered final classification for clinical questionnaires.',
                        code: `-- Desglose de clasificaciones clínicas de salud mental
SELECT clasificacion_final, COUNT(*) AS cantidad
FROM tkr_cuestionario_respuesta cr
JOIN tkr_cuestionarios c ON cr.id_cuestionario = c.id
WHERE cr.estado = 1 AND c.id_tipo_cuestionario = 2
GROUP BY clasificacion_final
ORDER BY cantidad DESC;`
                    }
                ]
            },
            sql_desglose_grilla: {
                type: 'sql',
                name: 'Desglose de Grilla',
                descEs: 'Consultas parametrizadas que recuperan estadísticas agregadas específicas para cada cuestionario listado en la grilla del Dashboard.',
                descEn: 'Parameterized queries that retrieve aggregate statistics specific to each questionnaire listed in the Dashboard grid.',
                queries: [
                    {
                        titleEs: '1. Total de Preguntas Activas por Cuestionario',
                        titleEn: '1. Total Active Questions per Questionnaire',
                        descEs: 'Cuenta el número de preguntas configuradas actualmente activas (estado = 1) en el cuestionario.',
                        descEn: 'Counts the number of active configured questions (status = 1) in the questionnaire.',
                        code: `-- Cantidad de preguntas activas para un cuestionario específico
SELECT COUNT(*) AS total_preguntas
FROM tkr_preguntas
WHERE id_cuestionario = :id_cuestionario AND estado = 1;`
                    }
                ]
            }
        };
    }, []);

    const highlightSQL = (code) => {
        const keywords = ['DECLARE', 'BEGIN', 'END', 'IN', 'OUT', 'PROCEDURE', 'VARCHAR2', 'NUMBER', 'CLOB', 'NULL', 'IS', 'AS', 'AND', 'OR', 'IF', 'THEN', 'ELSE', 'LOOP', 'COMMIT', 'ROLLBACK', 'SELECT', 'INTO', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'VALUES', 'SET', 'SYSDATE', 'TO_CHAR', 'CASE', 'WHEN', 'EXCEPTION', 'OTHERS', 'COUNT', 'SUM', 'AVG', 'ROUND', 'NVL', 'FLOOR', 'MOD', 'JOIN', 'ON', 'GROUP BY', 'ORDER BY', 'DBMS_LOB', 'AS'];
        let escaped = code
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        escaped = escaped.replace(/(--.*)/g, '<span class="text-[#6a9955]">$1</span>');
        escaped = escaped.replace(/('([^'\\]|\\.)*')/g, '<span class="text-[#ce9178]">$1</span>');
        keywords.forEach(kw => {
            const regex = new RegExp('\\\\b(' + kw + ')\\\\b', 'g');
            escaped = escaped.replace(regex, '<span class="text-[#569cd6] font-bold">$1</span>');
        });
        escaped = escaped.replace(/(pkgln_cuestionarios\\.[a-zA-Z0-9_]+)/g, '<span class="text-[#dcdcaa] font-bold">$1</span>');
        escaped = escaped.replace(/(DBMS_OUTPUT\\.[a-zA-Z0-9_]+)/g, '<span class="text-[#dcdcaa] font-bold">$1</span>');
        escaped = escaped.replace(/(DBMS_LOB\\.[a-zA-Z0-9_]+)/g, '<span class="text-[#dcdcaa] font-bold">$1</span>');
        return <pre className="font-mono text-xs text-[#d4d4d4] leading-relaxed whitespace-pre-wrap select-text" dangerouslySetInnerHTML={{ __html: escaped }} />;
    };

    const handleCopy = (id, text) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleExportDevHelpHTML = () => {
        const isEs = language === 'es';
        const title = isEs ? 'Documentación Técnica y Métricas del Dashboard' : 'Technical Documentation & Dashboard Metrics';
        
        let docsHtml = '';
        Object.keys(dashboardDocs).forEach(key => {
            const doc = dashboardDocs[key];
            
            if (doc.type === 'table') {
                let columnsTableHtml = `
                <h5>${isEs ? 'Definición de Columnas' : 'Column Definitions'}</h5>
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
                            ${doc.columns.map(c => `
                            <tr>
                                <td class="param-name">${c.name}</td>
                                <td class="param-type">${c.type}</td>
                                <td><span class="badge-req ${c.required ? 'req-yes' : 'req-no'}">${c.required ? (isEs ? 'Sí' : 'Yes') : (isEs ? 'No' : 'No')}</span></td>
                                <td>${isEs ? c.descEs : c.descEn}</td>
                            </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>`;

                docsHtml += `
                <div class="card" id="doc-${key}">
                    <div class="card-header">
                        <h4>📁 ${doc.name}</h4>
                    </div>
                    <div class="card-body">
                        <p class="desc">${isEs ? doc.descEs : doc.descEn}</p>
                        ${columnsTableHtml}
                    </div>
                </div>`;
            } else if (doc.type === 'sql') {
                let queriesHtml = '';
                doc.queries.forEach((q, idx) => {
                    const highlightSQLHtml = (code) => {
                        const keywords = ['DECLARE', 'BEGIN', 'END', 'IN', 'OUT', 'PROCEDURE', 'VARCHAR2', 'NUMBER', 'CLOB', 'NULL', 'IS', 'AS', 'AND', 'OR', 'IF', 'THEN', 'ELSE', 'LOOP', 'COMMIT', 'ROLLBACK', 'SELECT', 'INTO', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'VALUES', 'SET', 'SYSDATE', 'TO_CHAR', 'CASE', 'WHEN', 'EXCEPTION', 'OTHERS', 'COUNT', 'SUM', 'AVG', 'ROUND', 'NVL', 'FLOOR', 'MOD', 'JOIN', 'ON', 'GROUP BY', 'ORDER BY', 'DBMS_LOB', 'AS'];
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
                        escaped = escaped.replace(/(DBMS_LOB\\.[a-zA-Z0-9_]+)/g, '<span class="code-func">$&</span>');
                        return escaped;
                    };

                    queriesHtml += `
                    <div style="margin-bottom: 2rem; border-bottom: 1px dashed rgba(6, 182, 212, 0.15); padding-bottom: 1.5rem;">
                        <h4 style="color: var(--accent-orange); font-size: 1rem; margin-top: 0;">⚡ ${isEs ? q.titleEs : q.titleEn}</h4>
                        <p class="desc" style="font-size: 0.85rem; color: var(--text-muted);">${isEs ? q.descEs : q.descEn}</p>
                        <div class="code-block">
                            <div class="code-header">Oracle SQL</div>
                            <pre><code>${highlightSQLHtml(q.code)}</code></pre>
                        </div>
                    </div>`;
                });

                docsHtml += `
                <div class="card" id="doc-${key}">
                    <div class="card-header">
                        <h4>📊 ${doc.name}</h4>
                    </div>
                    <div class="card-body">
                        <p class="desc" style="font-weight: bold; border-bottom: 1px solid rgba(6, 182, 212, 0.2); padding-bottom: 0.5rem;">${isEs ? doc.descEs : doc.descEn}</p>
                        ${queriesHtml}
                    </div>
                </div>`;
            }
        });

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
            width: 290px;
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
        <h2>${isEs ? 'Tablas y Consultas' : 'Tables & Queries'}</h2>
        ${Object.keys(dashboardDocs).map(key => `
        <a href="#doc-${key}">${dashboardDocs[key].name}</a>
        `).join('')}
    </div>
    <div class="content">
        <div class="header">
            <h1>${title}</h1>
            <p>${isEs ? 'Referencia de Base de Datos y Métricas de Cuestionarios' : 'Database & Questionnaire Metrics Reference'}</p>
        </div>
        ${docsHtml}
    </div>
</body>
</html>`;

        const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'Doc_Dashboard_Cuestionarios.html');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Load data
    const loadData = useCallback(async () => {
        setLoadingStats(true);
        try {
            await fetchCuestionarios();
            const stats = await fetchDashboardStats();
            if (stats && stats.success) {
                setMetrics(stats.metrics);
                setBreakdown(stats.cuestionarios_desglose || []);
                setDistribucionClasif(stats.distribucion_clasificaciones || []);
                setDistribucionRiesgo(stats.distribucion_niveles_riesgo || []);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingStats(false);
        }
    }, [fetchCuestionarios, fetchDashboardStats]);

    useEffect(() => {
        if (initialized) {
            if (!user) {
                router.push('/');
            } else {
                const timer = setTimeout(() => {
                    loadData();
                }, 0);
                return () => clearTimeout(timer);
            }
        }
    }, [initialized, user, router, loadData]);

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

    // Handle logout
    const handleLogout = () => {
        logout();
        router.push('/');
    };

    // Toggle publish
    const handleTogglePublish = async (id, currentPublished) => {
        const action = currentPublished ? 'draft' : 'publish';
        const res = await changeEstadoCuestionario(id, action);
        if (res.success) {
            loadData();
        }
    };

    // Duplicate
    const handleDuplicate = async (id) => {
        const res = await duplicateCuestionario(id, null);
        if (res.success) {
            loadData();
        } else {
            await alert(language === 'es' ? 'Error al duplicar' : 'Error duplicating');
        }
    };

    // Delete
    const handleDelete = async (id) => {
        const confirmDelete = await confirm(language === 'es' ? '¿Está seguro de eliminar este cuestionario?' : 'Are you sure you want to delete this questionnaire?');
        if (!confirmDelete) return;

        const res = await changeEstadoCuestionario(id, 'delete');
        if (res.success) {
            loadData();
        } else {
            await alert(language === 'es' ? 'Error al eliminar' : 'Error deleting');
        }
    };

    // Create new Questionnaire
    const handleCreateCuestionario = async (e) => {
        e.preventDefault();
        if (!newNombre.trim()) {
            setCreateError(language === 'es' ? 'El nombre es obligatorio' : 'Name is required');
            return;
        }

        setIsCreating(true);
        setCreateError('');

        const initialData = {
            nombre: newNombre.trim(),
            descripcion: newDesc.trim(),
            id_tipo_cuestionario: newTipo,
            version: 1,
            publicado: 0,
            secciones: [],
            flujos: [],
            variables: [],
            resultados: []
        };

        const res = await saveCuestionario(initialData);
        setIsCreating(false);

        if (res.success) {
            setShowCreateModal(false);
            setNewNombre('');
            setNewDesc('');
            // Redirect to editor
            router.push(`/admin/editor/${res.id}`);
        } else {
            setCreateError(res.error || (language === 'es' ? 'Error al crear' : 'Error creating'));
        }
    };

    if (!initialized || !user) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#effaff] dark:bg-[#121212]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#ff7a39]"></div>
            </div>
        );
    }



    return (
        <div className="flex flex-col min-h-screen text-slate-800 dark:text-[#fafafa]">
            
            {/* Top Navbar */}
            <nav className="glass-panel mx-4 mt-4 px-6 py-4 flex flex-wrap justify-between items-center z-10 border-[#b6ecff] dark:border-[#262626]">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#ff7a39] to-[#ff5a1f] flex items-center justify-center shadow-md">
                        <span className="text-white font-bold text-lg">T</span>
                    </div>
                    <div>
                        <span className="font-bold tracking-tight text-white dark:text-[#fafafa]">Teker Apps</span>
                        <span className="text-xs block text-slate-400 font-semibold uppercase tracking-wider">{t('dashboard')}</span>
                    </div>
                </div>

                <div className="flex items-center gap-4 flex-wrap mt-2 sm:mt-0">
                    <div className="text-right hidden md:block">
                        <span className="text-sm font-semibold text-white dark:text-[#fafafa]">{user.usuario}</span>
                        <span className="text-xs block text-slate-400 font-medium">{user.rol}</span>
                    </div>

                    <button
                        onClick={() => setLanguage(language === 'es' ? 'en' : 'es')}
                        className="px-3 py-1.5 rounded-lg border border-[#b6ecff] dark:border-[#262626] text-xs font-semibold uppercase hover:border-[#ff7a39]"
                    >
                        {language === 'es' ? 'EN' : 'ES'}
                    </button>

                    <button
                        onClick={toggleTheme}
                        className="px-3 py-1.5 rounded-lg border border-[#b6ecff] dark:border-[#262626] text-xs font-semibold hover:border-[#ff7a39]"
                    >
                        {theme === 'light' ? '🌙' : '☀️'}
                    </button>

                    <button
                        onClick={handleLogout}
                        className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold hover:bg-red-500 hover:text-white transition-all"
                    >
                        {t('logout')}
                    </button>
                </div>
            </nav>

            <main className="flex-1 p-4 max-w-7xl w-full mx-auto space-y-6">
                {/* Metrics Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                    
                    {/* Stat: Total Questionnaires */}
                    <div className="glass-panel p-5 border-[#b6ecff] dark:border-[#262626] flex items-center justify-between">
                        <div>
                            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">{t('cuestionarios')}</span>
                            <h3 className="text-2xl font-extrabold text-white dark:text-[#fafafa] mt-1.5">
                                {loadingStats ? '...' : metrics.total_cuestionarios}
                            </h3>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-500 text-lg font-bold">
                            📋
                        </div>
                    </div>

                    {/* Stat: Total Questions */}
                    <div className="glass-panel p-5 border-[#b6ecff] dark:border-[#262626] flex items-center justify-between">
                        <div>
                            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">{language === 'es' ? 'Preguntas Totales' : 'Total Questions'}</span>
                            <h3 className="text-2xl font-extrabold text-white dark:text-[#fafafa] mt-1.5">
                                {loadingStats ? '...' : metrics.total_preguntas}
                            </h3>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-[#ff7a39] text-lg font-bold">
                            ❓
                        </div>
                    </div>

                    {/* Stat: Selección Única */}
                    <div className="glass-panel p-5 border-[#b6ecff] dark:border-[#262626] flex items-center justify-between">
                        <div>
                            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">{language === 'es' ? 'Selección Única' : 'Single Choice'}</span>
                            <h3 className="text-2xl font-extrabold text-white dark:text-[#fafafa] mt-1.5">
                                {loadingStats ? '...' : (metrics.count_unica || 0)}
                            </h3>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500 text-lg font-bold">
                            ●
                        </div>
                    </div>

                    {/* Stat: Selección Múltiple */}
                    <div className="glass-panel p-5 border-[#b6ecff] dark:border-[#262626] flex items-center justify-between">
                        <div>
                            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">{language === 'es' ? 'Selección Múltiple' : 'Multiple Choice'}</span>
                            <h3 className="text-2xl font-extrabold text-white dark:text-[#fafafa] mt-1.5">
                                {loadingStats ? '...' : (metrics.count_multiple || 0)}
                            </h3>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-550 dark:text-emerald-450 text-lg font-bold">
                            ☑️
                        </div>
                    </div>

                    {/* Stat: Abierta */}
                    <div className="glass-panel p-5 border-[#b6ecff] dark:border-[#262626] flex items-center justify-between">
                        <div>
                            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">{language === 'es' ? 'Preguntas Abiertas' : 'Open Text'}</span>
                            <h3 className="text-2xl font-extrabold text-white dark:text-[#fafafa] mt-1.5">
                                {loadingStats ? '...' : (metrics.count_abierta || 0)}
                            </h3>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500 text-lg font-bold">
                            ✏️
                        </div>
                    </div>

                    {/* Stat: Asociativa */}
                    <div className="glass-panel p-5 border-[#b6ecff] dark:border-[#262626] flex items-center justify-between">
                        <div>
                            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">{language === 'es' ? 'Preguntas Asociativas' : 'Matching'}</span>
                            <h3 className="text-2xl font-extrabold text-white dark:text-[#fafafa] mt-1.5">
                                {loadingStats ? '...' : (metrics.count_asociativa || 0)}
                            </h3>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 text-lg font-bold">
                            ⇄
                        </div>
                    </div>
                </div>

                {/* Clinical Metrics Row */}
                {!loadingStats && metrics.total_cuestionarios_sm > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="glass-panel p-5 border-[#c084fc]/30 dark:border-[#c084fc]/20 flex items-center justify-between bg-purple-500/5">
                            <div>
                                <span className="text-[10px] font-extrabold text-purple-450 dark:text-purple-400 uppercase tracking-wider">
                                    {language === 'es' ? 'Cuestionarios Clínicos' : 'Clinical Questionnaires'}
                                </span>
                                <h3 className="text-2xl font-extrabold text-white dark:text-[#fafafa] mt-1.5">
                                    {metrics.total_cuestionarios_sm}
                                </h3>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-450 dark:text-purple-355 text-lg font-bold">
                                🧠
                            </div>
                        </div>

                        <div className="glass-panel p-5 border-[#c084fc]/30 dark:border-[#c084fc]/20 flex items-center justify-between bg-purple-500/5">
                            <div>
                                <span className="text-[10px] font-extrabold text-purple-450 dark:text-purple-400 uppercase tracking-wider">
                                    {language === 'es' ? 'Variables Clínicas' : 'Clinical Variables'}
                                </span>
                                <h3 className="text-2xl font-extrabold text-white dark:text-[#fafafa] mt-1.5">
                                    {metrics.total_variables_calculadas}
                                </h3>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-450 dark:text-purple-355 text-lg font-bold">
                                ⚗️
                            </div>
                        </div>

                        <div className="glass-panel p-5 border-[#c084fc]/30 dark:border-[#c084fc]/20 flex items-center justify-between bg-purple-500/5">
                            <div>
                                <span className="text-[10px] font-extrabold text-purple-450 dark:text-purple-400 uppercase tracking-wider">
                                    {language === 'es' ? 'Rangos Clínicos' : 'Clinical Ranges'}
                                </span>
                                <h3 className="text-2xl font-extrabold text-white dark:text-[#fafafa] mt-1.5">
                                    {metrics.total_rangos_configurados}
                                </h3>
                            </div>
                            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-450 dark:text-purple-355 text-lg font-bold">
                                📊
                            </div>
                        </div>
                    </div>
                )}

                {/* Dashboard Main Layout (Tables) */}
                <div className="w-full">
                    
                    {/* Questionnaires List */}
                    <div className="glass-panel p-6 border-[#b6ecff] dark:border-[#262626] space-y-6 flex flex-col w-full">
                        <div className="flex justify-between items-center flex-wrap gap-2">
                            <div>
                                <h2 className="text-lg font-bold text-white dark:text-[#fafafa]">
                                    {t('cuestionarios')}
                                </h2>
                                <p className="text-xs text-slate-400 font-medium">
                                    {language === 'es' ? 'Formularios y evaluaciones del sistema.' : 'Forms and clinical assessments.'}
                                </p>
                            </div>

                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#ff7a39] to-[#ff5a1f] hover:from-[#e06020] hover:to-[#e04a14] text-white font-bold text-xs uppercase tracking-wider shadow-md shadow-orange-500/10 flex items-center gap-1.5 active:scale-[0.98] transition-all"
                            >
                                ➕ {t('create')}
                            </button>
                        </div>

                        {/* List / Table */}
                        <div className="flex-1 overflow-x-auto">
                            <table className="min-w-full divide-y divide-[#b6ecff]/30 dark:divide-[#262626]">
                                <thead>
                                    <tr className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                        <th className="py-3 px-4">{t('name')}</th>
                                        <th className="py-3 px-4 text-center">{language === 'es' ? 'Tipo' : 'Type'}</th>
                                        <th className="py-3 px-4 text-center">{t('version')}</th>
                                        <th className="py-3 px-4 text-center">Estado</th>
                                        <th className="py-3 px-4 text-center">{language === 'es' ? 'Preguntas' : 'Questions'}</th>
                                        <th className="py-3 px-4 text-right">{t('actions')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#b6ecff]/10 dark:divide-[#262626]/50 text-sm font-medium text-white dark:text-[#fafafa]">
                                    {loadingStats ? (
                                        <tr>
                                            <td colSpan="5" className="py-8 text-center text-slate-400 font-bold uppercase tracking-wider">
                                                {t('loading')}
                                            </td>
                                        </tr>
                                    ) : breakdown.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="py-8 text-center text-slate-400 font-bold uppercase tracking-wider">
                                                {language === 'es' ? 'No hay cuestionarios activos' : 'No active questionnaires'}
                                            </td>
                                        </tr>
                                    ) : (
                                        breakdown.map((item) => (
                                            <tr key={item.id} className="hover:bg-slate-200/20 dark:hover:bg-white/5 transition-all">
                                                <td className="py-3.5 px-4">
                                                    <span className="font-semibold text-white dark:text-[#fafafa]">{item.nombre}</span>
                                                </td>
                                                <td className="py-3.5 px-4 text-center">
                                                    <span className={`inline-block text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full ${
                                                        item.id_tipo_cuestionario === 2 
                                                            ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' 
                                                            : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                                     }`}>
                                                        {item.id_tipo_cuestionario === 2 ? (language === 'es' ? 'Salud Mental' : 'Mental Health') : (language === 'es' ? 'General' : 'General')}
                                                    </span>
                                                </td>
                                                <td className="py-3.5 px-4 text-center text-xs font-semibold text-slate-400">
                                                    {item.version}
                                                </td>
                                                <td className="py-3.5 px-4 text-center">
                                                    <span className={`inline-block text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full ${
                                                        item.publicado === 1 
                                                            ? 'bg-green-500/10 text-green-500 border border-green-500/20' 
                                                            : 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'
                                                     }`}>
                                                        {item.publicado === 1 ? t('published') : t('draft')}
                                                    </span>
                                                </td>
                                                <td className="py-3.5 px-4 text-center text-xs font-bold text-slate-300">
                                                    {item.total_preguntas || 0}
                                                </td>
                                                <td className="py-3.5 px-4 text-right">
                                                    <div className="flex justify-end gap-1.5">
                                                        {/* Print blank */}
                                                        <button
                                                            onClick={() => setPrintBlankItem(item)}
                                                            title={language === 'es' ? 'Imprimir en blanco' : 'Print blank'}
                                                            className="p-1.5 rounded-lg border border-[#b6ecff] dark:border-[#262626] hover:border-[#ff7a39] text-xs hover:bg-[#ff7a39] hover:text-white transition-all"
                                                        >
                                                            🖨️
                                                        </button>

                                                        {/* Preview link */}
                                                        <button
                                                            onClick={() => router.push(`/responder/${item.id}`)}
                                                            title={t('preview')}
                                                            className="p-1.5 rounded-lg border border-[#b6ecff] dark:border-[#262626] hover:border-[#00aae1] text-xs hover:bg-[#00aae1] hover:text-white transition-all"
                                                        >
                                                            👁️
                                                        </button>

                                                        {/* Edit link */}
                                                        <button
                                                            onClick={() => router.push(`/admin/editor/${item.id}`)}
                                                            title={item.publicado === 1
                                                                ? (language === 'es' ? 'Ver en modo lectura' : 'View in read-only mode')
                                                                : t('edit')
                                                            }
                                                            className={`p-1.5 rounded-lg border text-xs transition-all ${
                                                                item.publicado === 1
                                                                    ? 'text-cyan-400 border-cyan-500/50 hover:bg-cyan-500 hover:text-white'
                                                                    : 'border-[#b6ecff] dark:border-[#262626] hover:border-yellow-500 hover:bg-yellow-500 hover:text-white'
                                                            }`}
                                                        >
                                                            ✏️
                                                        </button>

                                                        {/* Toggle Publish button */}
                                                        <button
                                                            onClick={() => handleTogglePublish(item.id, item.publicado)}
                                                            title={item.publicado ? t('toDraft') : t('publish')}
                                                            className="p-1.5 rounded-lg border border-[#b6ecff] dark:border-[#262626] hover:border-green-500 text-xs hover:bg-green-500 hover:text-white transition-all"
                                                        >
                                                            {item.publicado ? '📥' : '📤'}
                                                        </button>

                                                        {/* Duplicate */}
                                                         <button
                                                             onClick={() => handleDuplicate(item.id)}
                                                             title={t('duplicate')}
                                                            className="p-1.5 rounded-lg border border-[#b6ecff] dark:border-[#262626] hover:border-cyan-500 text-xs hover:bg-cyan-500 hover:text-white transition-all"
                                                        >
                                                            👥
                                                        </button>

                                                        {/* Delete */}
                                                        <button
                                                            onClick={() => handleDelete(item.id)}
                                                            title={t('delete')}
                                                            className="p-1.5 rounded-lg border border-[#b6ecff] dark:border-[#262626] hover:border-red-500 text-xs hover:bg-red-500 hover:text-white transition-all"
                                                        >
                                                            🗑️
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Clinical Analytics Section */}
                    {!loadingStats && metrics.total_cuestionarios_sm > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                            {/* Distribución por Clasificación */}
                            <div className="glass-panel p-6 border-[#b6ecff]/30 dark:border-[#262626] flex flex-col bg-[#effaff]/30 dark:bg-purple-500/5">
                                <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-450 dark:text-slate-400 mb-4 flex items-center gap-2">
                                    📊 {language === 'es' ? 'Distribución de Diagnósticos' : 'Diagnostics Distribution'}
                                </h3>
                                {distribucionClasif.length === 0 ? (
                                    <p className="text-xs text-slate-400 py-8 text-center my-auto">
                                        {language === 'es' ? 'No hay clasificaciones calculadas aún' : 'No classifications calculated yet'}
                                    </p>
                                ) : (
                                    <div className="space-y-4">
                                        {distribucionClasif.map((item, idx) => {
                                            const total = distribucionClasif.reduce((sum, d) => sum + d.cantidad, 0);
                                            const pct = total > 0 ? Math.round((item.cantidad / total) * 100) : 0;
                                            return (
                                                <div key={idx} className="space-y-1.5">
                                                    <div className="flex justify-between text-xs font-semibold text-slate-600 dark:text-slate-350">
                                                        <span>{item.clasificacion}</span>
                                                        <span>{item.cantidad} ({pct}%)</span>
                                                    </div>
                                                    <div className="w-full bg-slate-700/30 rounded-full h-2">
                                                        <div 
                                                            className="bg-gradient-to-r from-purple-500 to-indigo-500 h-2 rounded-full" 
                                                            style={{ width: `${pct}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Distribución por Nivel de Riesgo */}
                            <div className="glass-panel p-6 border-[#b6ecff]/30 dark:border-[#262626] flex flex-col bg-[#effaff]/30 dark:bg-purple-500/5">
                                <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-450 dark:text-slate-400 mb-4 flex items-center gap-2">
                                    ⚠️ {language === 'es' ? 'Distribución por Nivel de Riesgo' : 'Risk Level Distribution'}
                                </h3>
                                {distribucionRiesgo.length === 0 ? (
                                    <p className="text-xs text-slate-400 py-8 text-center my-auto">
                                        {language === 'es' ? 'No hay datos de niveles de riesgo aún' : 'No risk level data yet'}
                                    </p>
                                ) : (
                                    <div className="space-y-4">
                                        {distribucionRiesgo.map((item, idx) => {
                                            const total = distribucionRiesgo.reduce((sum, d) => sum + d.cantidad, 0);
                                            const pct = total > 0 ? Math.round((item.cantidad / total) * 100) : 0;
                                            let barColor = 'from-emerald-500 to-teal-500';
                                            if (/grave|severo|alto|high|severe/i.test(item.rango)) {
                                                barColor = 'from-red-500 to-rose-500';
                                            } else if (/moderado|medio|moderate|medium/i.test(item.rango)) {
                                                barColor = 'from-amber-500 to-orange-500';
                                            } else if (/leve|bajo|mild|low/i.test(item.rango)) {
                                                barColor = 'from-blue-500 to-cyan-500';
                                            }
                                            return (
                                                <div key={idx} className="space-y-1.5">
                                                    <div className="flex justify-between text-xs font-semibold text-slate-650 dark:text-slate-350">
                                                        <span>{item.rango}</span>
                                                        <span>{item.cantidad} ({pct}%)</span>
                                                    </div>
                                                    <div className="w-full bg-slate-700/30 rounded-full h-2">
                                                        <div 
                                                            className={`bg-gradient-to-r ${barColor} h-2 rounded-full`} 
                                                            style={{ width: `${pct}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Modal: Create Questionnaire */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
                    <div className="w-full max-w-md glass-panel p-6 border-[#00aae1]/30 dark:border-[#06b6d4]/30 space-y-6 shadow-2xl bg-[#effaff]/98 dark:bg-[#071724]/98">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-bold text-[#04354d] dark:text-[#fafafa]">
                                {t('createCuestionario')}
                            </h3>
                            <button
                                onClick={() => {
                                    setShowCreateModal(false);
                                    setNewNombre('');
                                    setNewDesc('');
                                    setNewTipo(1);
                                    setCreateError('');
                                }}
                                className="text-slate-650 dark:text-slate-400 hover:text-red-500 text-lg font-semibold transition-all"
                            >
                                ✕
                            </button>
                        </div>

                        {createError && (
                            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-semibold text-center">
                                {createError}
                            </div>
                        )}

                        <form onSubmit={handleCreateCuestionario} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-350 mb-1.5">
                                    {t('name')}
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={newNombre}
                                    onChange={(e) => setNewNombre(e.target.value)}
                                    placeholder={language === 'es' ? 'Ej. Escala de Ansiedad' : 'e.g. Anxiety Assessment'}
                                    className="w-full px-4 py-2.5 rounded-lg bg-white/40 dark:bg-[#05141e]/50 border border-[#b6ecff] dark:border-[#06b6d4]/20 text-[#04354d] dark:text-[#fafafa] placeholder-slate-400 focus:outline-none focus:border-[#00aae1] focus:ring-1 focus:ring-[#00aae1] transition-all text-sm font-medium"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-350 mb-1.5">
                                    {t('description')}
                                </label>
                                <textarea
                                    value={newDesc}
                                    onChange={(e) => setNewDesc(e.target.value)}
                                    placeholder={language === 'es' ? 'Breve descripción del cuestionario...' : 'Brief summary of the questionnaire...'}
                                    rows="3"
                                    className="w-full px-4 py-2.5 rounded-lg bg-white/40 dark:bg-[#05141e]/50 border border-[#b6ecff] dark:border-[#06b6d4]/20 text-[#04354d] dark:text-[#fafafa] placeholder-slate-400 focus:outline-none focus:border-[#00aae1] focus:ring-1 focus:ring-[#00aae1] transition-all text-sm font-medium resize-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-350 mb-1.5">
                                    {language === 'es' ? 'Tipo de Cuestionario' : 'Questionnaire Type'}
                                </label>
                                <select
                                    value={newTipo}
                                    onChange={(e) => setNewTipo(parseInt(e.target.value))}
                                    className="w-full px-4 py-2.5 rounded-lg bg-white/45 dark:bg-[#05141e]/50 border border-[#b6ecff] dark:border-[#06b6d4]/20 text-[#04354d] dark:text-[#fafafa] focus:outline-none focus:border-[#00aae1] focus:ring-1 focus:ring-[#00aae1] transition-all text-sm font-medium"
                                >
                                    <option value={1} className="bg-slate-100 dark:bg-[#0c1a24] text-slate-800 dark:text-[#fafafa]">
                                        {language === 'es' ? 'General' : 'General'}
                                    </option>
                                    <option value={2} className="bg-slate-100 dark:bg-[#0c1a24] text-slate-800 dark:text-[#fafafa]">
                                        {language === 'es' ? 'Salud Mental (Clínico)' : 'Mental Health (Clinical)'}
                                    </option>
                                </select>
                            </div>

                            <div className="flex gap-2 justify-end pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowCreateModal(false);
                                        setNewNombre('');
                                        setNewDesc('');
                                        setNewTipo(1);
                                        setCreateError('');
                                    }}
                                    className="px-4 py-2 rounded-lg border border-[#b6ecff] dark:border-[#06b6d4]/20 hover:border-red-500 hover:text-red-500 text-slate-700 dark:text-slate-200 text-xs font-bold uppercase transition-all"
                                >
                                    {t('cancel')}
                                </button>
                                <button
                                    type="submit"
                                    disabled={isCreating}
                                    className="px-5 py-2 rounded-lg bg-gradient-to-r from-[#ff7a39] to-[#ff5a1f] hover:from-[#e06020] hover:to-[#e04a14] text-slate-50 font-bold text-xs uppercase tracking-wider shadow-md transition-all active:scale-[0.98] disabled:opacity-70 flex items-center gap-1.5"
                                >
                                    {isCreating ? (
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    ) : (
                                        t('save')
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Modal: Print Blank Questionnaire */}
            {printBlankItem && (
                <PrintBlankModal
                    item={printBlankItem}
                    language={language}
                    onClose={() => setPrintBlankItem(null)}
                    fetchCuestionarioDetalle={fetchCuestionarioDetalle}
                />
            )}

            {/* Modal de Ayuda al Programador (Ctrl+Alt+D) */}
            {showDevHelpModal && (
                <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
                    <div className="w-full max-w-6xl h-[85vh] glass-panel border-[#00aae1]/30 dark:border-[#06b6d4]/30 flex flex-col shadow-2xl overflow-hidden animate-scale-up bg-[#effaff]/98 dark:bg-[#071724]/98">
                        {/* Header */}
                        <div className="p-5 border-b border-[#00aae1]/20 dark:border-[#06b6d4]/20 flex justify-between items-center bg-[#effaff]/50 dark:bg-[#040e16]/80">
                            <div className="flex items-center gap-2">
                                <span className="text-xl">💻</span>
                                <h3 className="text-base font-bold text-[#04354d] dark:text-[#fafafa]">
                                    {language === 'es' ? 'Documentación del Desarrollador (Dashboard & Tablas)' : 'Developer Documentation (Dashboard & Tables)'}
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
                            {/* Left Side: Sidebar of tables and queries */}
                            <div className="w-80 border-r border-[#00aae1]/20 dark:border-[#06b6d4]/20 bg-[#effaff]/50 dark:bg-[#040e16]/80 overflow-y-auto p-4 space-y-1.5 flex flex-col animate-fade-in">
                                <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#ff7a39] dark:text-[#ffa36c] px-2.5 mt-2 mb-2 block">
                                    {language === 'es' ? 'Modelo de Datos (Tablas)' : 'Data Model (Tables)'}
                                </span>
                                {Object.keys(dashboardDocs).filter(k => dashboardDocs[k].type === 'table').map((key) => {
                                    const doc = dashboardDocs[key];
                                    return (
                                        <button
                                            key={key}
                                            onClick={() => setActiveDevTab(key)}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-mono font-bold transition-all truncate ${
                                                activeDevTab === key
                                                    ? 'bg-[#00aae1] text-slate-50 shadow-md'
                                                    : 'hover:bg-[#00aae1]/10 dark:hover:bg-[#06b6d4]/10 text-slate-700 dark:text-slate-350 hover:text-[#00aae1] dark:hover:text-[#06b6d4]'
                                            }`}
                                        >
                                            📄 {doc.name}
                                        </button>
                                    );
                                })}

                                <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#ff7a39] dark:text-[#ffa36c] px-2.5 mt-4 mb-2 block">
                                    {language === 'es' ? 'Consultas del Dashboard' : 'Dashboard Queries'}
                                </span>
                                {Object.keys(dashboardDocs).filter(k => dashboardDocs[k].type === 'sql').map((key) => {
                                    const doc = dashboardDocs[key];
                                    return (
                                        <button
                                            key={key}
                                            onClick={() => setActiveDevTab(key)}
                                            className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all truncate ${
                                                activeDevTab === key
                                                    ? 'bg-[#00aae1] text-slate-50 shadow-md'
                                                    : 'hover:bg-[#00aae1]/10 dark:hover:bg-[#06b6d4]/10 text-slate-700 dark:text-slate-350 hover:text-[#00aae1] dark:hover:text-[#06b6d4]'
                                            }`}
                                        >
                                            📊 {language === 'es' ? doc.name : doc.name}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Right Side: Details panel */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                {(() => {
                                    const doc = dashboardDocs[activeDevTab];
                                    if (!doc) return null;
                                    if (doc.type === 'table') {
                                        return (
                                            <div className="space-y-6 p-6 rounded-xl bg-white/90 dark:bg-[#0a1e2b]/80 border border-[#00aae1]/20 dark:border-[#06b6d4]/20 shadow-sm animate-fade-in">
                                                <div>
                                                    <h4 className="text-lg font-mono font-bold text-[#04354d] dark:text-[#fafafa] border-b border-[#00aae1]/10 pb-2">
                                                        {doc.name}
                                                    </h4>
                                                    <p className="text-xs text-slate-700 dark:text-slate-200 mt-3 leading-relaxed font-medium">
                                                        {language === 'es' ? doc.descEs : doc.descEn}
                                                    </p>
                                                </div>

                                                {/* Columns table */}
                                                <div className="space-y-3">
                                                    <h5 className="text-xs font-extrabold uppercase tracking-wider text-slate-650 dark:text-slate-400">
                                                        {language === 'es' ? 'Definición de Columnas' : 'Column Definitions'}
                                                    </h5>
                                                    <div className="overflow-x-auto border border-[#00aae1]/25 dark:border-[#06b6d4]/20 rounded-xl bg-[#effaff]/90 dark:bg-[#05141e]/90 p-3.5 shadow-inner">
                                                        <table className="min-w-full divide-y divide-[#00aae1]/20 dark:divide-[#06b6d4]/20">
                                                            <thead>
                                                                <tr className="text-left text-[10px] font-bold text-slate-750 dark:text-slate-300 uppercase tracking-widest border-b border-[#00aae1]/25 dark:border-[#06b6d4]/20">
                                                                    <th className="py-2.5 px-3">{language === 'es' ? 'Columna' : 'Column'}</th>
                                                                    <th className="py-2.5 px-3">{language === 'es' ? 'Tipo' : 'Type'}</th>
                                                                    <th className="py-2.5 px-3">{language === 'es' ? 'Requerido' : 'Required'}</th>
                                                                    <th className="py-2.5 px-3">{language === 'es' ? 'Descripción' : 'Description'}</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-[#00aae1]/10 dark:divide-[#06b6d4]/10 text-xs text-slate-700 dark:text-slate-300">
                                                                {doc.columns.map((c, idx) => (
                                                                    <tr key={idx} className="hover:bg-[#00aae1]/5 dark:hover:bg-[#06b6d4]/10">
                                                                        <td className="py-2.5 px-3 font-mono font-bold text-[#ff7a39] dark:text-[#ffa36c]">{c.name}</td>
                                                                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 font-semibold">{c.type}</td>
                                                                        <td className="py-2.5 px-3">
                                                                            <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-extrabold ${c.required ? 'bg-red-500/10 text-red-500' : 'bg-slate-500/10 text-slate-600 dark:text-slate-300'}`}>
                                                                                {c.required ? (language === 'es' ? 'Sí' : 'Yes') : (language === 'es' ? 'No' : 'No')}
                                                                            </span>
                                                                        </td>
                                                                        <td className="py-2.5 px-3 leading-relaxed font-medium">{language === 'es' ? c.descEs : c.descEn}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    } else if (doc.type === 'sql') {
                                        return (
                                            <div className="space-y-6 animate-fade-in">
                                                {doc.queries.map((q, idx) => (
                                                    <div key={idx} className="p-6 rounded-xl bg-white/90 dark:bg-[#0a1e2b]/80 border border-[#00aae1]/20 dark:border-[#06b6d4]/20 shadow-sm space-y-4">
                                                        <div>
                                                            <h4 className="text-md font-extrabold text-[#04354d] dark:text-[#fafafa] flex items-center gap-2">
                                                                <span className="text-[#00aae1]">⚡</span> {language === 'es' ? q.titleEs : q.titleEn}
                                                            </h4>
                                                            <p className="text-xs text-slate-650 dark:text-slate-300 mt-1 leading-relaxed font-medium">
                                                                {language === 'es' ? q.descEs : q.descEn}
                                                            </p>
                                                        </div>

                                                        {/* Code Editor block (VS Code / Monaco styling) */}
                                                        <div className="relative border border-[#06b6d4]/30 dark:border-[#06b6d4]/40 bg-[#1e1e1e] rounded-xl overflow-hidden shadow-lg">
                                                            <div className="flex justify-between items-center bg-[#252526] px-4 py-2 border-b border-[#06b6d4]/20">
                                                                <span className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider">Oracle SQL</span>
                                                                <button
                                                                    onClick={() => handleCopy(`${activeDevTab}_${idx}`, q.code)}
                                                                    className="px-2.5 py-1 text-[10px] font-extrabold uppercase rounded bg-[#00aae1] hover:bg-[#008dbb] text-slate-50 transition-all active:scale-[0.98]"
                                                                >
                                                                    {copiedId === `${activeDevTab}_${idx}` ? (language === 'es' ? '✓ Copiado' : '✓ Copied') : (language === 'es' ? '📋 Copiar' : '📋 Copy')}
                                                                </button>
                                                            </div>
                                                            <div className="p-4 overflow-x-auto max-h-80 select-text">
                                                                {highlightSQL(q.code)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    }
                                    return null;
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

// ---------------------------------------------------------------------------
// PrintBlankModal: loads questionnaire structure and renders all questions
// as an empty form, then calls window.print().
// ---------------------------------------------------------------------------
function PrintBlankModal({ item, language, onClose, fetchCuestionarioDetalle }) {
    const [cuest, setCuest] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            const data = await fetchCuestionarioDetalle(item.id);
            setCuest(data);
            setLoading(false);
        };
        load();
    }, [item.id, fetchCuestionarioDetalle]);

    const handlePrint = () => window.print();

    // Flatten all questions
    const allQuestions = [];
    if (cuest) {
        (cuest.secciones || []).forEach(sec => {
            (sec.preguntas || []).forEach(q => allQuestions.push({
                ...q,
                seccionId: sec.id,
                seccionNombre: sec.nombre
            }));
        });
    }

    const loc = language === 'es' ? 'es-ES' : 'en-US';
    const now = new Date().toLocaleDateString(loc, { day: 'numeric', month: 'short', year: 'numeric' });

    // Helper: render single question blank template
    const renderQuestionMarkup = (q, idx) => {
        return (
            <div key={q.id || idx} className="border-b border-slate-200 pb-5 last:border-0 print:avoid-break">
                <div className="flex items-start gap-2 mb-3">
                    <span className="text-[10px] font-black text-white px-2 py-0.5 rounded shrink-0" style={{ background: '#ff7a39' }}>
                        {q.codigo || `P${idx + 1}`}
                    </span>
                    <p className="text-sm font-extrabold text-slate-800 leading-snug">
                        {q.texto_pregunta}
                        {q.obligatoria === 1 && <span className="text-red-500 ml-1">*</span>}
                    </p>
                </div>

                {/* Render by type */}
                {(q.tipo_codigo === 'UNICA' || q.tipo_codigo === 'MULTIPLE') && (
                    <div className="ml-1 space-y-2">
                        {(q.opciones || []).map(op => (
                            <div key={op.id} className="flex items-center gap-2 text-xs text-slate-700">
                                <div className={`w-3.5 h-3.5 shrink-0 border border-slate-400 ${
                                    q.tipo_codigo === 'UNICA' ? 'rounded-full' : 'rounded'
                                }`} />
                                <span>{op.texto_opcion}</span>
                            </div>
                        ))}
                    </div>
                )}

                {q.tipo_codigo === 'ABIERTA' && (
                    <div className="ml-1 border border-slate-200 rounded-lg h-16 bg-slate-50 relative">
                        <div className="absolute inset-x-4 bottom-3 border-b border-dashed border-slate-300" />
                        <div className="absolute inset-x-4 bottom-8 border-b border-dashed border-slate-300" />
                    </div>
                )}

                {q.tipo_codigo === 'ASOCIATIVA' && (
                    <div className="ml-1 grid grid-cols-2 gap-4">
                        <div>
                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block mb-1">
                                {language === 'es' ? 'Columna A' : 'Column A'}
                            </span>
                            <div className="space-y-2">
                                {(q.asociaciones || []).map((a, i) => (
                                    <div key={a.id} className="p-2 border border-slate-200 rounded text-xs font-semibold text-slate-700 bg-slate-50">
                                        {i + 1}. {a.item_izquierdo}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block mb-1">
                                {language === 'es' ? 'Columna B' : 'Column B'}
                            </span>
                            <div className="space-y-2">
                                {(q.asociaciones || []).map(a => (
                                    <div key={a.id} className="p-2 border border-slate-200 rounded text-xs font-semibold text-slate-700 flex justify-between bg-slate-50">
                                        <span>[ &nbsp; ] &nbsp; {a.item_derecho}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex flex-col overflow-auto">
            {/* Toolbar — hidden on print */}
            <div className="no-print sticky top-0 z-10 bg-slate-950/95 border-b border-slate-800 px-6 py-3 flex justify-between items-center gap-4">
                <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-white uppercase tracking-wider">
                        🖨️ {language === 'es' ? 'Cuestionario en Blanco' : 'Blank Questionnaire'}
                    </span>
                    <span className="text-[10px] text-slate-400 font-semibold truncate max-w-xs">{item.nombre}</span>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handlePrint}
                        disabled={loading || !cuest}
                        className="px-5 py-2 rounded-lg bg-gradient-to-r from-[#ff7a39] to-[#ff5a1f] text-white font-extrabold text-xs uppercase tracking-wider shadow-md transition-all active:scale-[0.98] disabled:opacity-50"
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
                {loading ? (
                    <div className="flex items-center justify-center w-full">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#ff7a39]" />
                    </div>
                ) : !cuest ? (
                    <div className="text-white text-center py-20">
                        {language === 'es' ? 'No se pudo cargar el cuestionario.' : 'Could not load the questionnaire.'}
                    </div>
                ) : (
                    <div className="print-area w-full max-w-3xl bg-white text-slate-800 p-10 shadow-2xl rounded-xl h-fit">

                        {/* Header */}
                        <div className="flex justify-between items-start border-b-2 border-slate-300 pb-5 mb-6">
                            <div className="flex gap-4 items-center">
                                <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-sm" style={{ background: 'linear-gradient(135deg, #ff7a39, #ff5a1f)' }}>
                                    <span className="text-white font-bold text-xl">T</span>
                                </div>
                                <div>
                                    <h2 className="text-md font-extrabold uppercase tracking-wide text-slate-800">Teker Apps</h2>
                                    <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                                        {language === 'es' ? 'Formulario de Evaluación' : 'Evaluation Form'}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="text-xs font-bold text-slate-500 uppercase block">{language === 'es' ? 'Fecha' : 'Date'}</span>
                                <span className="text-xs font-extrabold text-slate-800">{now}</span>
                            </div>
                        </div>

                        {/* Title & description */}
                        <h1 className="text-2xl font-black text-slate-800 tracking-tight mb-1">{cuest.nombre}</h1>
                        {cuest.descripcion && (
                            <p className="text-xs text-slate-500 italic mb-6">{cuest.descripcion}</p>
                        )}

                        {/* Metadata: patient / evaluator signature lines */}
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-8 grid grid-cols-2 gap-4 text-xs">
                            <div className="flex justify-between border-b border-slate-200 pb-2">
                                <span className="font-bold text-slate-500 uppercase tracking-wider">{language === 'es' ? 'Paciente:' : 'Patient:'}</span>
                                <span className="text-slate-400">_________________________</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-200 pb-2">
                                <span className="font-bold text-slate-500 uppercase tracking-wider">{language === 'es' ? 'Evaluador:' : 'Evaluator:'}</span>
                                <span className="text-slate-400">_________________________</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-200 pb-2">
                                <span className="font-bold text-slate-500 uppercase tracking-wider">{language === 'es' ? 'Fecha:' : 'Date:'}</span>
                                <span className="text-slate-400">_________________________</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-200 pb-2">
                                <span className="font-bold text-slate-500 uppercase tracking-wider">{language === 'es' ? 'Versión:' : 'Version:'}</span>
                                <span className="font-extrabold text-slate-700">v{cuest.version || '1.0'}</span>
                            </div>
                        </div>

                        {/* Questions */}
                        {cuest.secciones && cuest.secciones.length > 1 ? (
                            cuest.secciones.map((sec, secIdx) => {
                                const secQuestions = sec.preguntas || [];
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
                        <div className="mt-16 pt-8 border-t-2 border-slate-300 grid grid-cols-3 gap-8">
                            {[language === 'es' ? 'Firma del Evaluador' : 'Evaluator Signature',
                              language === 'es' ? 'Firma del Paciente' : 'Patient Signature',
                              language === 'es' ? 'Sello Institucional' : 'Institutional Stamp'
                            ].map(label => (
                                <div key={label} className="text-center">
                                    <div className="h-14" />
                                    <div className="border-t border-slate-400 pt-2 text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                                        {label}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Print-only CSS */}
            <style>{`
                @media print {
                    .no-print { display: none !important; }
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
