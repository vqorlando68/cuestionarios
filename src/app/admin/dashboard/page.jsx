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
                    { name: 'descripcion', type: 'CLOB', required: false, descEs: 'Descripción detallada o instrucciones.', descEn: 'Detailed description or instructions.' },
                    { name: 'version', type: 'NUMBER', required: true, descEs: 'Número de versión secuencial.', descEn: 'Sequential version number.' },
                    { name: 'publicado', type: 'NUMBER(1)', required: true, descEs: 'Indicador de publicación (1 = Publicado, 0 = Borrador).', descEn: 'Publication indicator (1 = Published, 0 = Draft).' },
                    { name: 'fecha_creacion', type: 'DATE', required: true, descEs: 'Fecha de creación del cuestionario.', descEn: 'Date when the questionnaire was created.' },
                    { name: 'fecha_publicacion', type: 'DATE', required: false, descEs: 'Fecha de la última publicación.', descEn: 'Date of the last publication.' },
                    { name: 'id_tipo_cuestionario', type: 'NUMBER (FK)', required: false, descEs: 'ID del tipo de cuestionario asociado en TKR_TIPOS_CUESTIONARIO (ej. 1 = General, 2 = Salud Mental).', descEn: 'ID of the questionnaire type associated in TKR_TIPOS_CUESTIONARIO (e.g. 1 = General, 2 = Mental Health).' },
                    { name: 'estado', type: 'NUMBER(1)', required: true, descEs: 'Estado lógico (1 = Activo, 0 = Eliminado/Inactivo).', descEn: 'Logical status (1 = Active, 0 = Deleted/Inactive).' }
                ]
            },
            tkr_tipos_cuestionario: {
                type: 'table',
                name: 'TKR_TIPOS_CUESTIONARIO',
                descEs: 'Catálogo de clasificación de tipos de cuestionario para habilitar flujos o configuraciones específicas (ej. General, Salud Mental).',
                descEn: 'Catalog classification of questionnaire types to enable specific flows or configurations (e.g. General, Mental Health).',
                columns: [
                    { name: 'id', type: 'NUMBER (PK)', required: true, descEs: 'Identificador único del tipo de cuestionario.', descEn: 'Unique type identifier.' },
                    { name: 'codigo', type: 'VARCHAR2(50)', required: true, descEs: 'Código único de identificación (ej. GENERAL, SALUD_MENTAL).', descEn: 'Unique identification code (e.g. GENERAL, SALUD_MENTAL).' },
                    { name: 'nombre', type: 'VARCHAR2(200)', required: true, descEs: 'Nombre descriptivo del tipo de cuestionario.', descEn: 'Descriptive name of the questionnaire type.' },
                    { name: 'descripcion', type: 'VARCHAR2(1000)', required: false, descEs: 'Descripción detallada de la finalidad de este tipo.', descEn: 'Detailed description of this type\'s purpose.' },
                    { name: 'estado', type: 'NUMBER(1)', required: true, descEs: 'Estado lógico (1 = Activo, 0 = Inactivo).', descEn: 'Logical status (1 = Active, 0 = Inactive).' }
                ]
            },
            tkr_secciones_cuestionario: {
                type: 'table',
                name: 'TKR_SECCIONES_CUESTIONARIO',
                descEs: 'Define las secciones, páginas o categorías que agrupan preguntas de un cuestionario.',
                descEn: 'Defines the sections, pages, or categories grouping questions within a questionnaire.',
                columns: [
                    { name: 'id', type: 'NUMBER (PK)', required: true, descEs: 'Identificador único de la sección.', descEn: 'Unique section identifier.' },
                    { name: 'id_cuestionario', type: 'NUMBER (FK)', required: true, descEs: 'ID del cuestionario asociado en TKR_CUESTIONARIOS.', descEn: 'ID of the associated questionnaire in TKR_CUESTIONARIOS.' },
                    { name: 'nombre', type: 'VARCHAR2(300)', required: true, descEs: 'Nombre de la sección.', descEn: 'Name of the section.' },
                    { name: 'descripcion', type: 'VARCHAR2(1000)', required: false, descEs: 'Explicación corta o instrucciones de la sección.', descEn: 'Short description or instructions of the section.' },
                    { name: 'orden_visual', type: 'NUMBER', required: true, descEs: 'Orden visual de renderizado en el cuestionario.', descEn: 'Visual rendering order in the questionnaire.' },
                    { name: 'estado', type: 'NUMBER(1)', required: true, descEs: 'Estado lógico (1 = Activo, 0 = Eliminado).', descEn: 'Logical status (1 = Active, 0 = Deleted).' }
                ]
            },
            tkr_preguntas: {
                type: 'table',
                name: 'TKR_PREGUNTAS',
                descEs: 'Registra el catálogo de preguntas asociadas a los cuestionarios y secciones.',
                descEn: 'Registers the catalog of questions associated with questionnaires and sections.',
                columns: [
                    { name: 'id', type: 'NUMBER (PK)', required: true, descEs: 'Identificador único de la pregunta.', descEn: 'Unique question identifier.' },
                    { name: 'id_cuestionario', type: 'NUMBER (FK)', required: true, descEs: 'ID del cuestionario relacionado.', descEn: 'ID of the related questionnaire.' },
                    { name: 'id_seccion_cuestionario', type: 'NUMBER (FK)', required: false, descEs: 'ID de la sección donde pertenece (si aplica).', descEn: 'ID of the section it belongs to (if applicable).' },
                    { name: 'id_tipo_pregunta', type: 'NUMBER (FK)', required: true, descEs: 'ID del tipo de pregunta en TKR_TIPOS_PREGUNTA.', descEn: 'ID of the question type in TKR_TIPOS_PREGUNTA.' },
                    { name: 'codigo', type: 'VARCHAR2(100)', required: true, descEs: 'Código visual corto de la pregunta (ej. P1, P2).', descEn: 'Short visual code of the question (e.g. P1, P2).' },
                    { name: 'texto_pregunta', type: 'CLOB', required: true, descEs: 'Texto o enunciado completo de la pregunta.', descEn: 'Full text or prompt of the question.' },
                    { name: 'orden_visual', type: 'NUMBER', required: true, descEs: 'Orden secuencial de aparición.', descEn: 'Sequential display order.' },
                    { name: 'obligatoria', type: 'NUMBER(1)', required: true, descEs: 'Indica si responder es mandatorio (1 = Sí, 0 = No).', descEn: 'Indicates if answering is mandatory (1 = Yes, 0 = No).' },
                    { name: 'valor_pregunta', type: 'NUMBER', required: false, descEs: 'Puntaje base de la pregunta.', descEn: 'Base score of the question.' },
                    { name: 'permite_otro', type: 'NUMBER(1)', required: false, descEs: 'Permite opción "Otro" de texto libre en selección única/múltiple.', descEn: 'Allows free-text "Other" option in single/multiple choice.' },
                    { name: 'estado', type: 'NUMBER(1)', required: true, descEs: 'Estado lógico (1 = Activo, 0 = Eliminado).', descEn: 'Logical status (1 = Active, 0 = Deleted).' }
                ]
            },
            tkr_opciones_pregunta: {
                type: 'table',
                name: 'TKR_OPCIONES_PREGUNTA',
                descEs: 'Opciones de respuesta precargadas para preguntas de selección única o múltiple.',
                descEn: 'Preloaded answer choices for single or multiple selection questions.',
                columns: [
                    { name: 'id', type: 'NUMBER (PK)', required: true, descEs: 'Identificador de la opción.', descEn: 'Unique option identifier.' },
                    { name: 'id_pregunta', type: 'NUMBER (FK)', required: true, descEs: 'ID de la pregunta relacionada.', descEn: 'ID of the related question.' },
                    { name: 'texto_opcion', type: 'VARCHAR2(4000)', required: true, descEs: 'Texto visible de la opción.', descEn: 'Visible option text.' },
                    { name: 'codigo_opcion', type: 'VARCHAR2(100)', required: true, descEs: 'Código identificador de la opción (ej. OP1).', descEn: 'Option identifier code (e.g. OP1).' },
                    { name: 'orden_visual', type: 'NUMBER', required: true, descEs: 'Posición de renderizado en la lista.', descEn: 'Rendering position in the list.' },
                    { name: 'valor_opcion', type: 'NUMBER', required: false, descEs: 'Puntaje acumulativo otorgado al seleccionar esta opción.', descEn: 'Cumulative score awarded when choosing this option.' },
                    { name: 'estado', type: 'NUMBER(1)', required: true, descEs: 'Estado lógico (1 = Activo, 0 = Eliminado).', descEn: 'Logical status (1 = Active, 0 = Deleted).' }
                ]
            },
            tkr_pregunta_asociativa: {
                type: 'table',
                name: 'TKR_PREGUNTA_ASOCIATIVA',
                descEs: 'Definición de pares o correspondencias para preguntas de emparejamiento (matching).',
                descEn: 'Definition of pairs or matchings for matching-type questions.',
                columns: [
                    { name: 'id', type: 'NUMBER (PK)', required: true, descEs: 'Identificador único del emparejamiento.', descEn: 'Unique matching pair identifier.' },
                    { name: 'id_pregunta', type: 'NUMBER (FK)', required: true, descEs: 'ID de la pregunta de tipo ASOCIATIVA relacionada.', descEn: 'ID of the associated matching question.' },
                    { name: 'item_izquierdo', type: 'VARCHAR2(1000)', required: true, descEs: 'Elemento de la columna izquierda (Columna A).', descEn: 'Element of the left column (Column A).' },
                    { name: 'item_derecho', type: 'VARCHAR2(1000)', required: true, descEs: 'Elemento correspondiente de la columna derecha (Columna B).', descEn: 'Corresponding element of the right column (Column B).' },
                    { name: 'valor_correcto', type: 'NUMBER', required: false, descEs: 'Puntaje que se otorga si se relaciona este par correctamente.', descEn: 'Score awarded if this pair is correctly matched.' },
                    { name: 'estado', type: 'NUMBER(1)', required: true, descEs: 'Estado lógico (1 = Activo, 0 = Eliminado).', descEn: 'Logical status (1 = Active, 0 = Deleted).' }
                ]
            },
            tkr_variables_calculadas: {
                type: 'table',
                name: 'TKR_VARIABLES_CALCULADAS',
                descEs: 'Define las variables clínicas, sub-escalas o dimensiones de cálculo para evaluaciones de tipo Salud Mental.',
                descEn: 'Defines the clinical variables, sub-scales, or calculation dimensions for Mental Health type evaluations.',
                columns: [
                    { name: 'id', type: 'NUMBER (PK)', required: true, descEs: 'Identificador único de la variable calculada.', descEn: 'Unique calculated variable identifier.' },
                    { name: 'id_cuestionario', type: 'NUMBER (FK)', required: true, descEs: 'ID del cuestionario asociado en TKR_CUESTIONARIOS.', descEn: 'ID of the associated questionnaire in TKR_CUESTIONARIOS.' },
                    { name: 'codigo', type: 'VARCHAR2(100)', required: true, descEs: 'Código visual corto de la variable (ej. VAR_DEP).', descEn: 'Short visual code of the variable (e.g. VAR_DEP).' },
                    { name: 'nombre', type: 'VARCHAR2(500)', required: true, descEs: 'Nombre formal o título de la dimensión clínica.', descEn: 'Formal name or title of the clinical dimension.' },
                    { name: 'descripcion', type: 'VARCHAR2(1000)', required: false, descEs: 'Descripción clínica detallada de lo que mide esta variable.', descEn: 'Detailed clinical description of what this variable measures.' },
                    { name: 'formula_calculo', type: 'VARCHAR2(1000)', required: false, descEs: 'Fórmula de agregación matemática (por defecto: SUM).', descEn: 'Mathematical aggregation formula (default: SUM).' },
                    { name: 'orden_visual', type: 'NUMBER', required: true, descEs: 'Posición de ordenamiento en los resultados clínicos.', descEn: 'Sorting order position in clinical results.' },
                    { name: 'estado', type: 'NUMBER(1)', required: true, descEs: 'Estado lógico (1 = Activo, 0 = Eliminado).', descEn: 'Logical status (1 = Active, 0 = Deleted).' }
                ]
            },
            tkr_variables_calculadas_det: {
                type: 'table',
                name: 'TKR_VARIABLES_CALCULADAS_DET',
                descEs: 'Detalle asociativo de las preguntas y ponderaciones (pesos) asignadas para el cálculo de cada variable clínica.',
                descEn: 'Associative details of the questions and weights assigned for the calculation of each clinical variable.',
                columns: [
                    { name: 'id', type: 'NUMBER (PK)', required: true, descEs: 'Identificador único de la regla.', descEn: 'Unique detail rule identifier.' },
                    { name: 'id_variable_calculada', type: 'NUMBER (FK)', required: true, descEs: 'ID de la variable cabecera en TKR_VARIABLES_CALCULADAS.', descEn: 'ID of the header variable in TKR_VARIABLES_CALCULADAS.' },
                    { name: 'id_pregunta', type: 'NUMBER (FK)', required: true, descEs: 'ID de la pregunta de TKR_PREGUNTAS asociada a la variable.', descEn: 'ID of the question from TKR_PREGUNTAS associated with the variable.' },
                    { name: 'peso', type: 'NUMBER', required: true, descEs: 'Ponderador o coeficiente multiplicador aplicado al valor de la respuesta (ej. 1, 1.5, -2).', descEn: 'Weight or multiplier coefficient applied to the answer value (e.g. 1, 1.5, -2).' },
                    { name: 'estado', type: 'NUMBER(1)', required: true, descEs: 'Estado lógico (1 = Activo, 0 = Eliminado).', descEn: 'Logical status (1 = Active, 0 = Deleted).' }
                ]
            },
            tkr_rangos_interpretacion: {
                type: 'table',
                name: 'TKR_RANGOS_INTERPRETACION',
                descEs: 'Define los rangos de interpretación específicos que se asocian a las puntuaciones obtenidas en las variables clínicas.',
                descEn: 'Defines the specific interpretation ranges associated with scores obtained in clinical variables.',
                columns: [
                    { name: 'id', type: 'NUMBER (PK)', required: true, descEs: 'Identificador único del rango.', descEn: 'Unique range identifier.' },
                    { name: 'id_cuestionario', type: 'NUMBER (FK)', required: true, descEs: 'ID del cuestionario relacionado.', descEn: 'ID of the related questionnaire.' },
                    { name: 'id_variable_calculada', type: 'NUMBER (FK)', required: false, descEs: 'ID de la variable calculada asociada en TKR_VARIABLES_CALCULADAS (ej. DEPRESION_TOTAL).', descEn: 'ID of the associated calculated variable in TKR_VARIABLES_CALCULADAS (e.g. DEPRESION_TOTAL).' },
                    { name: 'valor_minimo', type: 'NUMBER', required: true, descEs: 'Límite de puntaje mínimo inclusivo para este rango.', descEn: 'Inclusive minimum score limit for this range.' },
                    { name: 'valor_maximo', type: 'NUMBER', required: true, descEs: 'Límite de puntaje máximo inclusivo para este rango.', descEn: 'Inclusive maximum score limit for this range.' },
                    { name: 'clasificacion', type: 'VARCHAR2(500)', required: true, descEs: 'Clasificación o etiqueta de interpretación clínica (ej. Leve, Severa).', descEn: 'Clinical interpretation classification or tag (e.g. Mild, Severe).' },
                    { name: 'descripcion', type: 'VARCHAR2(1000)', required: false, descEs: 'Explicación detallada del significado clínico de este rango y recomendaciones.', descEn: 'Detailed explanation of the clinical meaning of this range and recommendations.' },
                    { name: 'color_visual', type: 'VARCHAR2(100)', required: true, descEs: 'Color semántico utilizado para el badge de resultados (green, orange, red, blue, grey).', descEn: 'Semantic color used for the result badge (green, orange, red, blue, grey).' },
                    { name: 'estado', type: 'NUMBER(1)', required: true, descEs: 'Estado lógico (1 = Activo, 0 = Eliminado).', descEn: 'Logical status (1 = Active, 0 = Deleted).' },
                    { name: 'nombre_rango', type: 'VARCHAR2(500)', required: true, descEs: 'Título o identificador corto del rango de interpretación.', descEn: 'Title or short identifier of the interpretation range.' }
                ]
            },
            tkr_cuestionario_respuesta: {
                type: 'table',
                name: 'TKR_CUESTIONARIO_RESPUESTA',
                descEs: 'Cabecera de las respuestas o intentos de resolución por sesión del diligenciador.',
                descEn: 'Header for user answers or attempt sessions in the filler system.',
                columns: [
                    { name: 'id', type: 'NUMBER (PK)', required: true, descEs: 'Identificador único de la sesión de respuestas.', descEn: 'Unique answer session identifier.' },
                    { name: 'id_cuestionario', type: 'NUMBER (FK)', required: true, descEs: 'ID del cuestionario respondido.', descEn: 'ID of the answered questionnaire.' },
                    { name: 'id_usuario', type: 'NUMBER', required: false, descEs: 'ID del usuario/médico que completó el cuestionario.', descEn: 'ID of the user/doctor who completed the questionnaire.' },
                    { name: 'fecha_inicio', type: 'DATE', required: true, descEs: 'Fecha y hora exactas de inicio de la sesión.', descEn: 'Exact start date and time of the session.' },
                    { name: 'fecha_fin', type: 'DATE', required: false, descEs: 'Fecha y hora de finalización (NULO si la sesión sigue en borrador).', descEn: 'End date and time (NULL if session is still a draft).' },
                    { name: 'puntaje_total', type: 'NUMBER', required: false, descEs: 'Puntaje acumulativo total alcanzado.', descEn: 'Total cumulative score reached.' },
                    { name: 'clasificacion_final', type: 'VARCHAR2(500)', required: false, descEs: 'Categoría final mapeada del puntaje (ej. Riesgo Severo).', descEn: 'Final score classification category (e.g. Severe Risk).' },
                    { name: 'estado', type: 'NUMBER(1)', required: true, descEs: 'Estado de la sesión (1 = Finalizado, 2 = En proceso/Borrador).', descEn: 'Session state (1 = Completed, 2 = In progress/Draft).' }
                ]
            },
            tkr_respuestas: {
                type: 'table',
                name: 'TKR_RESPUESTAS',
                descEs: 'Almacena la respuesta individual del usuario para cada pregunta del cuestionario.',
                descEn: 'Stores the individual user response for each question in the questionnaire.',
                columns: [
                    { name: 'id', type: 'NUMBER (PK)', required: true, descEs: 'Identificador de la respuesta.', descEn: 'Unique answer identifier.' },
                    { name: 'id_cuestionario_respuesta', type: 'NUMBER (FK)', required: true, descEs: 'ID de la sesión de respuestas cabecera.', descEn: 'ID of the header response session.' },
                    { name: 'id_pregunta', type: 'NUMBER (FK)', required: true, descEs: 'ID de la pregunta respondida.', descEn: 'ID of the answered question.' },
                    { name: 'respuesta_texto', type: 'CLOB', required: false, descEs: 'Respuesta en texto (texto libre para ABIERTA, o mapeo JSON de parejas para ASOCIATIVA).', descEn: 'Text answer (free text for OPEN, or JSON map of matching pairs for MATCHING).' },
                    { name: 'respuesta_numero', type: 'NUMBER', required: false, descEs: 'Respuesta numérica.', descEn: 'Numeric answer.' },
                    { name: 'respuesta_fecha', type: 'DATE', required: false, descEs: 'Respuesta en formato fecha.', descEn: 'Date-format answer.' },
                    { name: 'valor_obtenido', type: 'NUMBER', required: false, descEs: 'Puntaje obtenido individualmente en esta pregunta.', descEn: 'Score obtained individually on this question.' },
                    { name: 'estado', type: 'NUMBER(1)', required: true, descEs: 'Estado de la respuesta (1 = Activo).', descEn: 'Answer status (1 = Active).' }
                ]
            },
            tkr_respuesta_opciones: {
                type: 'table',
                name: 'TKR_RESPUESTA_OPCIONES',
                descEs: 'Detalle asociativo para registrar múltiples opciones seleccionadas en preguntas de selección múltiple (o única).',
                descEn: 'Associative details for registering multiple choices selected in multiple-choice questions.',
                columns: [
                    { name: 'id', type: 'NUMBER (PK)', required: true, descEs: 'Identificador único de la fila.', descEn: 'Unique row identifier.' },
                    { name: 'id_respuesta', type: 'NUMBER (FK)', required: true, descEs: 'ID de la respuesta en TKR_RESPUESTAS.', descEn: 'ID of the answer in TKR_RESPUESTAS.' },
                    { name: 'id_opcion_pregunta', type: 'NUMBER (FK)', required: true, descEs: 'ID de la opción seleccionada de TKR_OPCIONES_PREGUNTA.', descEn: 'ID of the chosen option from TKR_OPCIONES_PREGUNTA.' },
                    { name: 'valor_obtenido', type: 'NUMBER', required: false, descEs: 'Valor de puntos sumados por esta opción específica.', descEn: 'Score value added by this specific option.' },
                    { name: 'estado', type: 'NUMBER(1)', required: true, descEs: 'Estado de la opción (1 = Activo).', descEn: 'Option status (1 = Active).' }
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
