CREATE OR REPLACE PACKAGE BODY pkgln_cuestionarios AS

  /* Helper to escape double quotes and backslashes in JSON strings */
  FUNCTION f_escape_json(p_str IN VARCHAR2) RETURN VARCHAR2 IS
    v_res VARCHAR2(32767);
  BEGIN
    IF p_str IS NULL THEN
      RETURN '';
    END IF;
    v_res := REPLACE(p_str, '\', '\\');
    v_res := REPLACE(v_res, '"', '\"');
    v_res := REPLACE(v_res, CHR(10), '\n');
    v_res := REPLACE(v_res, CHR(13), '\r');
    v_res := REPLACE(v_res, CHR(9), '\t');
    RETURN v_res;
  END f_escape_json;

  /* Helper to read CLOB content */
  FUNCTION f_clob_to_str(p_clob IN CLOB) RETURN VARCHAR2 IS
  BEGIN
    IF p_clob IS NULL THEN
      RETURN '';
    END IF;
    RETURN DBMS_LOB.SUBSTR(p_clob, 4000, 1);
  END f_clob_to_str;

  -- 1. List all questionnaires and summary statistics
  PROCEDURE sp_obtener_cuestionarios(
    p_input   IN  CLOB,
    p_output  OUT CLOB,
    p_success OUT NUMBER
  ) AS
    v_clob CLOB;
    v_primero BOOLEAN := TRUE;
    v_total_respuestas NUMBER;
    v_completadas NUMBER;
    v_tasa_finalizacion NUMBER;
  BEGIN
    p_success := 1;
    DBMS_LOB.CREATETEMPORARY(v_clob, TRUE);
    DBMS_LOB.APPEND(v_clob, '{"success":true,"data":[');

    FOR r IN (
      SELECT c.id, c.nombre, c.descripcion, c.version, c.publicado, c.fecha_creacion, c.fecha_publicacion, c.estado, c.id_tipo_cuestionario, c.presentacion_unica
      FROM tkr_cuestionarios c
      WHERE c.estado = 1
      ORDER BY c.fecha_creacion DESC
    ) LOOP
      IF NOT v_primero THEN
        DBMS_LOB.APPEND(v_clob, ',');
      END IF;
      v_primero := FALSE;

      -- Calculate statistics for this questionnaire
      SELECT COUNT(*), COUNT(CASE WHEN estado = 1 THEN 1 END)
      INTO v_total_respuestas, v_completadas
      FROM tkr_cuestionario_respuesta
      WHERE id_cuestionario = r.id;

      IF v_total_respuestas > 0 THEN
        v_tasa_finalizacion := ROUND((v_completadas / v_total_respuestas) * 100);
      ELSE
        v_tasa_finalizacion := 0;
      END IF;

      DBMS_LOB.APPEND(v_clob, '{"id":' || r.id || 
        ',"nombre":"' || f_escape_json(r.nombre) || '"' ||
        ',"descripcion":"' || f_escape_json(f_clob_to_str(r.descripcion)) || '"' ||
        ',"version":' || NVL(r.version, 1) ||
        ',"publicado":' || NVL(r.publicado, 0) ||
        ',"id_tipo_cuestionario":' || NVL(r.id_tipo_cuestionario, 1) ||
        ',"presentacion_unica":' || NVL(r.presentacion_unica, 0) ||
        ',"fecha_creacion":"' || TO_CHAR(r.fecha_creacion, 'YYYY-MM-DD"T"HH24:MI:SS') || '"' ||
        ',"fecha_publicacion":' || CASE WHEN r.fecha_publicacion IS NOT NULL THEN '"' || TO_CHAR(r.fecha_publicacion, 'YYYY-MM-DD"T"HH24:MI:SS') || '"' ELSE 'null' END ||
        ',"total_respuestas":' || v_total_respuestas ||
        ',"completion_rate":' || v_tasa_finalizacion || '}');
    END LOOP;

    DBMS_LOB.APPEND(v_clob, ']}');
    p_output := v_clob;
  EXCEPTION
    WHEN OTHERS THEN
      p_success := 0;
      p_output := '{"success":false,"error":"' || REPLACE(SQLERRM, '"', '\"') || '"}';
  END sp_obtener_cuestionarios;

  -- 2. Get full definition of a single questionnaire
  PROCEDURE sp_obtener_cuestionario_detalle(
    p_input   IN  CLOB,
    p_output  OUT CLOB,
    p_success OUT NUMBER
  ) AS
    v_id_cuestionario NUMBER;
    v_clob CLOB;
    v_cuest_encontrado BOOLEAN := FALSE;
    v_primer_sec BOOLEAN := TRUE;
    v_primer_preg BOOLEAN := TRUE;
    v_primer_op BOOLEAN := TRUE;
    v_primer_assoc BOOLEAN := TRUE;
    v_primer_flujo BOOLEAN := TRUE;
    v_primer_regla BOOLEAN := TRUE;
    v_primer_var BOOLEAN := TRUE;
    v_primer_res BOOLEAN := TRUE;
  BEGIN
    p_success := 1;
    v_id_cuestionario := JSON_VALUE(p_input, '$.id' RETURNING NUMBER);

    IF v_id_cuestionario IS NULL THEN
      p_success := 0;
      p_output := '{"success":false,"error":"Falta el parámetro id"}';
      RETURN;
    END IF;

    DBMS_LOB.CREATETEMPORARY(v_clob, TRUE);

    -- Load Questionnaire Metadata
    FOR c IN (
      SELECT id, nombre, descripcion, version, publicado, fecha_creacion, fecha_publicacion, estado, id_tipo_cuestionario, presentacion_unica
      FROM tkr_cuestionarios
      WHERE id = v_id_cuestionario AND estado = 1
    ) LOOP
      v_cuest_encontrado := TRUE;
      DBMS_LOB.APPEND(v_clob, '{"success":true,"data":{' ||
        '"id":' || c.id ||
        ',"nombre":"' || f_escape_json(c.nombre) || '"' ||
        ',"descripcion":"' || f_escape_json(f_clob_to_str(c.descripcion)) || '"' ||
        ',"version":' || NVL(c.version, 1) ||
        ',"publicado":' || NVL(c.publicado, 0) ||
        ',"id_tipo_cuestionario":' || NVL(c.id_tipo_cuestionario, 1) ||
        ',"presentacion_unica":' || NVL(c.presentacion_unica, 0) ||
        ',"fecha_creacion":"' || TO_CHAR(c.fecha_creacion, 'YYYY-MM-DD"T"HH24:MI:SS') || '"' ||
        ',"fecha_publicacion":' || CASE WHEN c.fecha_publicacion IS NOT NULL THEN '"' || TO_CHAR(c.fecha_publicacion, 'YYYY-MM-DD"T"HH24:MI:SS') || '"' ELSE 'null' END ||
        ',"secciones":[');

      -- Sections Loop
      FOR s IN (
        SELECT id, nombre, descripcion, orden_visual
        FROM tkr_secciones_cuestionario
        WHERE id_cuestionario = c.id AND estado = 1
        ORDER BY orden_visual
      ) LOOP
        IF NOT v_primer_sec THEN
          DBMS_LOB.APPEND(v_clob, ',');
        END IF;
        v_primer_sec := FALSE;

        DBMS_LOB.APPEND(v_clob, '{"id":' || s.id ||
          ',"nombre":"' || f_escape_json(s.nombre) || '"' ||
          ',"descripcion":"' || f_escape_json(s.descripcion) || '"' ||
          ',"orden_visual":' || NVL(s.orden_visual, 0) ||
          ',"preguntas":[');

        v_primer_preg := TRUE;
        -- Questions Loop
        FOR p IN (
          SELECT q.id, q.id_tipo_pregunta, t.codigo as tipo_codigo, q.codigo, q.texto_pregunta, q.orden_visual, q.obligatoria, q.valor_pregunta, q.permite_otro
          FROM tkr_preguntas q, tkr_tipos_pregunta t
          WHERE q.id_seccion_cuestionario = s.id AND q.id_tipo_pregunta = t.id AND q.estado = 1
          ORDER BY q.orden_visual
        ) LOOP
          IF NOT v_primer_preg THEN
            DBMS_LOB.APPEND(v_clob, ',');
          END IF;
          v_primer_preg := FALSE;

          DBMS_LOB.APPEND(v_clob, '{"id":' || p.id ||
            ',"id_tipo_pregunta":' || p.id_tipo_pregunta ||
            ',"tipo_codigo":"' || p.tipo_codigo || '"' ||
            ',"codigo":"' || f_escape_json(p.codigo) || '"' ||
            ',"texto_pregunta":"' || f_escape_json(f_clob_to_str(p.texto_pregunta)) || '"' ||
            ',"orden_visual":' || NVL(p.orden_visual, 0) ||
            ',"obligatoria":' || NVL(p.obligatoria, 0) ||
            ',"valor_pregunta":' || NVL(p.valor_pregunta, 0) ||
            ',"permite_otro":' || NVL(p.permite_otro, 0) ||
            ',"opciones":[');

          v_primer_op := TRUE;
          -- Options Loop (for single/multiple choice)
          FOR o IN (
            SELECT id, texto_opcion, codigo_opcion, orden_visual, valor_opcion
            FROM tkr_opciones_pregunta
            WHERE id_pregunta = p.id AND estado = 1
            ORDER BY orden_visual
          ) LOOP
            IF NOT v_primer_op THEN
              DBMS_LOB.APPEND(v_clob, ',');
            END IF;
            v_primer_op := FALSE;

            DBMS_LOB.APPEND(v_clob, '{"id":' || o.id ||
              ',"texto_opcion":"' || f_escape_json(o.texto_opcion) || '"' ||
              ',"codigo_opcion":"' || f_escape_json(o.codigo_opcion) || '"' ||
              ',"orden_visual":' || NVL(o.orden_visual, 0) ||
              ',"valor_opcion":' || NVL(o.valor_opcion, 0) || '}');
          END LOOP;

          DBMS_LOB.APPEND(v_clob, '],"asociaciones":[');

          v_primer_assoc := TRUE;
          -- Associative items loop (for matching questions)
          FOR a IN (
            SELECT id, item_izquierdo, item_derecho, valor_correcto
            FROM tkr_pregunta_asociativa
            WHERE id_pregunta = p.id AND estado = 1
          ) LOOP
            IF NOT v_primer_assoc THEN
              DBMS_LOB.APPEND(v_clob, ',');
            END IF;
            v_primer_assoc := FALSE;

            DBMS_LOB.APPEND(v_clob, '{"id":' || a.id ||
              ',"item_izquierdo":"' || f_escape_json(a.item_izquierdo) || '"' ||
              ',"item_derecho":"' || f_escape_json(a.item_derecho) || '"' ||
              ',"valor_correcto":' || NVL(a.valor_correcto, 0) || '}');
          END LOOP;

          DBMS_LOB.APPEND(v_clob, ']}');
        END LOOP;

        DBMS_LOB.APPEND(v_clob, ']}');
      END LOOP;

      DBMS_LOB.APPEND(v_clob, '],"flujos":[');

      -- Questionnaire logical flows loop
      FOR f IN (
        SELECT fp.id, fp.id_pregunta_origen, qo.codigo as codigo_pregunta_origen, fp.id_opcion_respuesta, op.codigo_opcion as codigo_opcion_respuesta,
               fp.id_operador, ope.codigo as operador_codigo, fp.valor_comparacion, fp.id_pregunta_destino, qd.codigo as codigo_pregunta_destino, fp.prioridad
        FROM tkr_flujos_pregunta fp
        JOIN tkr_preguntas qo ON fp.id_pregunta_origen = qo.id
        LEFT JOIN tkr_opciones_pregunta op ON fp.id_opcion_respuesta = op.id
        LEFT JOIN tkr_operadores ope ON fp.id_operador = ope.id
        JOIN tkr_preguntas qd ON fp.id_pregunta_destino = qd.id
        WHERE qo.id_cuestionario = c.id AND fp.estado = 1
        ORDER BY fp.prioridad
      ) LOOP
        IF NOT v_primer_flujo THEN
          DBMS_LOB.APPEND(v_clob, ',');
        END IF;
        v_primer_flujo := FALSE;

        DBMS_LOB.APPEND(v_clob, '{"id":' || f.id ||
          ',"id_pregunta_origen":' || f.id_pregunta_origen ||
          ',"codigo_pregunta_origen":"' || f.codigo_pregunta_origen || '"' ||
          ',"id_opcion_respuesta":' || NVL(TO_CHAR(f.id_opcion_respuesta), 'null') ||
          ',"codigo_opcion_respuesta":' || CASE WHEN f.codigo_opcion_respuesta IS NOT NULL THEN '"' || f.codigo_opcion_respuesta || '"' ELSE 'null' END ||
          ',"id_operador":' || NVL(TO_CHAR(f.id_operador), 'null') ||
          ',"operador_codigo":' || CASE WHEN f.operador_codigo IS NOT NULL THEN '"' || f.operador_codigo || '"' ELSE 'null' END ||
          ',"valor_comparacion":' || CASE WHEN f.valor_comparacion IS NOT NULL THEN '"' || f_escape_json(f.valor_comparacion) || '"' ELSE 'null' END ||
          ',"id_pregunta_destino":' || f.id_pregunta_destino ||
          ',"codigo_pregunta_destino":"' || f.codigo_pregunta_destino || '"' ||
          ',"prioridad":' || NVL(f.prioridad, 0) ||
          ',"reglas":[');

        v_primer_regla := TRUE;
        -- Rules for this logical flow
        FOR r IN (
          SELECT id, campo_evaluado, operador, valor_esperado, agrupador
          FROM tkr_reglas_flujo
          WHERE id_flujo_pregunta = f.id AND estado = 1
        ) LOOP
          IF NOT v_primer_regla THEN
            DBMS_LOB.APPEND(v_clob, ',');
          END IF;
          v_primer_regla := FALSE;

          DBMS_LOB.APPEND(v_clob, '{"id":' || r.id ||
            ',"campo_evaluado":"' || f_escape_json(r.campo_evaluado) || '"' ||
            ',"operador":"' || r.operador || '"' ||
            ',"valor_esperado":"' || f_escape_json(r.valor_esperado) || '"' ||
            ',"agrupador":"' || r.agrupador || '"}');
        END LOOP;

        DBMS_LOB.APPEND(v_clob, ']}');
      END LOOP;

      -- Clinical Variables
      DBMS_LOB.APPEND(v_clob, '],"variables":[');
      v_primer_var := TRUE;
      FOR v IN (
        SELECT id, codigo, nombre, descripcion, formula_calculo, valor_minimo, valor_maximo, unidad_medida, orden_visual
        FROM tkr_variables_calculadas
        WHERE id_cuestionario = c.id AND estado = 1
        ORDER BY orden_visual
      ) LOOP
        IF NOT v_primer_var THEN
          DBMS_LOB.APPEND(v_clob, ',');
        END IF;
        v_primer_var := FALSE;

        DBMS_LOB.APPEND(v_clob, '{"id":' || v.id ||
          ',"codigo":"' || f_escape_json(v.codigo) || '"' ||
          ',"nombre":"' || f_escape_json(v.nombre) || '"' ||
          ',"descripcion":"' || f_escape_json(v.descripcion) || '"' ||
          ',"formula_calculo":"' || f_escape_json(v.formula_calculo) || '"' ||
          ',"valor_minimo":' || NVL(TO_CHAR(v.valor_minimo), 'null') ||
          ',"valor_maximo":' || NVL(TO_CHAR(v.valor_maximo), 'null') ||
          ',"unidad_medida":"' || f_escape_json(v.unidad_medida) || '"' ||
          ',"orden_visual":' || v.orden_visual ||
          ',"preguntas_asociadas":[');

        -- Questions associated detail
        DECLARE
          v_primer_det BOOLEAN := TRUE;
        BEGIN
          FOR d IN (
            SELECT id, id_pregunta, peso, orden_visual
            FROM tkr_variables_calculadas_det
            WHERE id_variable_calculada = v.id AND estado = 1
            ORDER BY orden_visual
          ) LOOP
            IF NOT v_primer_det THEN
              DBMS_LOB.APPEND(v_clob, ',');
            END IF;
            v_primer_det := FALSE;
            DBMS_LOB.APPEND(v_clob, '{"id":' || d.id ||
              ',"id_pregunta":' || d.id_pregunta ||
              ',"peso":' || d.peso ||
              ',"orden_visual":' || d.orden_visual || '}');
          END LOOP;
        END;
        DBMS_LOB.APPEND(v_clob, ']}');
      END LOOP;

      -- Clinical results ranges
      DBMS_LOB.APPEND(v_clob, '],"resultados_clinicos":[');
      v_primer_res := TRUE;
      FOR r IN (
        SELECT id, nombre_rango, descripcion, valor_minimo, valor_maximo, clasificacion, color_visual, orden_visual, id_variable_calculada
        FROM tkr_rangos_interpretacion
        WHERE id_cuestionario = c.id AND estado = 1
        ORDER BY orden_visual
      ) LOOP
        IF NOT v_primer_res THEN
          DBMS_LOB.APPEND(v_clob, ',');
        END IF;
        v_primer_res := FALSE;

        DBMS_LOB.APPEND(v_clob, '{"id":' || r.id ||
          ',"nombre_rango":"' || f_escape_json(r.nombre_rango) || '"' ||
          ',"descripcion":"' || f_escape_json(r.descripcion) || '"' ||
          ',"valor_minimo":' || r.valor_minimo ||
          ',"valor_maximo":' || r.valor_maximo ||
          ',"clasificacion":"' || f_escape_json(r.clasificacion) || '"' ||
          ',"color_visual":"' || f_escape_json(r.color_visual) || '"' ||
          ',"orden_visual":' || r.orden_visual || 
          ',"id_variable_calculada":' || NVL(TO_CHAR(r.id_variable_calculada), 'null') || '}');
      END LOOP;

      DBMS_LOB.APPEND(v_clob, '],"resultados":[');

      -- Score range results loop (general)
      FOR r IN (
        SELECT id, puntaje_desde, puntaje_hasta, nombre_resultado, descripcion, color
        FROM tkr_resultados_cuestionario
        WHERE id_cuestionario = c.id AND estado = 1
        ORDER BY puntaje_desde
      ) LOOP
        IF NOT v_primer_res THEN
          DBMS_LOB.APPEND(v_clob, ',');
        END IF;
        v_primer_res := FALSE;

        DBMS_LOB.APPEND(v_clob, '{"id":' || r.id ||
          ',"puntaje_desde":' || NVL(r.puntaje_desde, 0) ||
          ',"puntaje_hasta":' || NVL(r.puntaje_hasta, 0) ||
          ',"nombre_resultado":"' || f_escape_json(r.nombre_resultado) || '"' ||
          ',"descripcion":"' || f_escape_json(f_clob_to_str(r.descripcion)) || '"' ||
          ',"color":"' || f_escape_json(r.color) || '"}');
      END LOOP;

      DBMS_LOB.APPEND(v_clob, ']}');
    END LOOP;

    IF NOT v_cuest_encontrado THEN
      p_success := 0;
      p_output := '{"success":false,"error":"Cuestionario no encontrado"}';
    ELSE
      DBMS_LOB.APPEND(v_clob, '}');
      p_output := v_clob;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      p_success := 0;
      p_output := '{"success":false,"error":"' || REPLACE(SQLERRM, '"', '\"') || '"}';
  END sp_obtener_cuestionario_detalle;

  -- 3. Save or update a questionnaire structure
  PROCEDURE sp_guardar_cuestionario(
    p_input   IN  CLOB,
    p_output  OUT CLOB,
    p_success OUT NUMBER
  ) AS
    v_id NUMBER;
    v_nombre VARCHAR2(500);
    v_descripcion CLOB;
    v_publicado NUMBER(1);
    v_version NUMBER;
    v_id_tipo_cuestionario NUMBER;
    v_presentacion_unica NUMBER(1);
    v_cuest_id NUMBER;
    v_has_responses NUMBER;

    -- JSON arrays elements counters
    v_sec_count NUMBER;
    v_preg_count NUMBER;
    v_op_count NUMBER;
    v_assoc_count NUMBER;
    v_flujo_count NUMBER;

    -- Local loop variables
    v_sec_idx NUMBER;
    v_sec_id NUMBER;
    v_sec_nombre VARCHAR2(300);
    v_sec_desc VARCHAR2(1000);
    v_sec_orden NUMBER;

    v_preg_idx NUMBER;
    v_preg_id NUMBER;
    v_preg_tipo_cod VARCHAR2(50);
    v_preg_tipo_id NUMBER;
    v_preg_codigo VARCHAR2(100);
    v_preg_texto CLOB;
    v_preg_orden NUMBER;
    v_preg_oblig NUMBER;
    v_preg_valor NUMBER;
    v_preg_otro NUMBER;

    v_op_idx NUMBER;
    v_op_id NUMBER;
    v_op_texto VARCHAR2(4000);
    v_op_codigo VARCHAR2(100);
    v_op_orden NUMBER;
    v_op_valor NUMBER;

    v_assoc_idx NUMBER;
    v_assoc_id NUMBER;
    v_assoc_izq VARCHAR2(1000);
    v_assoc_der VARCHAR2(1000);
    v_assoc_val NUMBER;

    v_flujo_idx NUMBER;
    v_flujo_id NUMBER;
    v_flujo_orig_cod VARCHAR2(100);
    v_flujo_orig_id NUMBER;
    v_flujo_op_cod VARCHAR2(100);
    v_flujo_op_id NUMBER;
    v_flujo_oper_cod VARCHAR2(50);
    v_flujo_oper_id NUMBER;
    v_flujo_comparacion VARCHAR2(4000);
    v_flujo_dest_cod VARCHAR2(100);
    v_flujo_dest_id NUMBER;
    v_flujo_prioridad NUMBER;

    v_res_idx NUMBER;
    v_res_id NUMBER;
    v_res_desde NUMBER;
    v_res_hasta NUMBER;
    v_res_nombre VARCHAR2(500);
    v_res_desc CLOB;
    v_res_color VARCHAR2(30);

    -- Rules loop variables
    v_reglas_count NUMBER;
    v_reglas_idx NUMBER;
    v_regla_campo VARCHAR2(100);
    v_regla_oper VARCHAR2(30);
    v_regla_esp VARCHAR2(4000);
    v_regla_agrup VARCHAR2(10);

    -- Clinical variables and arrays
    v_vars_calc JSON_ARRAY_T;
    v_var_calc JSON_OBJECT_T;
    v_dets_calc JSON_ARRAY_T;
    v_det_calc JSON_OBJECT_T;
    v_rangos_clinicos JSON_ARRAY_T;
    v_rango_clinico JSON_OBJECT_T;
    
    v_var_codigo VARCHAR2(100);
    v_var_nombre VARCHAR2(200);
    v_var_desc VARCHAR2(1000);
    v_var_formula VARCHAR2(1000);
    v_var_min NUMBER;
    v_var_max NUMBER;
    v_var_unidad VARCHAR2(100);
    v_var_orden NUMBER;
    
    v_det_preg_id NUMBER;
    v_det_peso NUMBER;
    v_det_orden NUMBER;
    
    v_r_nombre VARCHAR2(200);
    v_r_desc VARCHAR2(1000);
    v_r_min NUMBER;
    v_r_max NUMBER;
    v_r_clasif VARCHAR2(200);
    v_r_color VARCHAR2(50);
    v_r_orden NUMBER;

    -- Native JSON variables
    v_input_obj JSON_OBJECT_T;
    v_secciones JSON_ARRAY_T;

    -- Question ID Mapping for clinical variable questions detail
    TYPE t_preg_id_map IS TABLE OF NUMBER INDEX BY VARCHAR2(100);
    v_preg_id_map t_preg_id_map;
    v_seccion JSON_OBJECT_T;
    v_preguntas JSON_ARRAY_T;
    v_pregunta JSON_OBJECT_T;
    v_opciones JSON_ARRAY_T;
    v_opcion JSON_OBJECT_T;
    v_asociaciones JSON_ARRAY_T;
    v_asociacion JSON_OBJECT_T;
    
    v_flujos JSON_ARRAY_T;
    v_flujo JSON_OBJECT_T;
    v_reglas JSON_ARRAY_T;
    v_regla JSON_OBJECT_T;
    
    v_resultados JSON_ARRAY_T;
    v_resultado JSON_OBJECT_T;

  BEGIN
    p_success := 1;
    
    -- Parse root JSON object
    v_input_obj := JSON_OBJECT_T.parse(p_input);
    
    IF v_input_obj.has('id') AND NOT v_input_obj.get('id').is_null THEN
      v_id := v_input_obj.get_number('id');
    ELSE
      v_id := NULL;
    END IF;
    
    v_nombre := v_input_obj.get_string('nombre');
    v_descripcion := v_input_obj.get_string('descripcion');
    v_publicado := NVL(v_input_obj.get_number('publicado'), 0);
    v_version := NVL(v_input_obj.get_number('version'), 1);

    IF v_input_obj.has('id_tipo_cuestionario') AND NOT v_input_obj.get('id_tipo_cuestionario').is_null THEN
      v_id_tipo_cuestionario := v_input_obj.get_number('id_tipo_cuestionario');
    ELSE
      v_id_tipo_cuestionario := 1; -- Default to GENERAL
    END IF;

    IF v_input_obj.has('presentacion_unica') AND NOT v_input_obj.get('presentacion_unica').is_null THEN
      v_presentacion_unica := v_input_obj.get_number('presentacion_unica');
    ELSE
      v_presentacion_unica := 0;
    END IF;

    IF v_nombre IS NULL THEN
      p_success := 0;
      p_output := '{"success":false,"error":"El nombre del cuestionario es requerido"}';
      RETURN;
    END IF;

    -- Check if questionnaire has responses
    v_has_responses := 0;
    IF v_id IS NOT NULL THEN
      SELECT COUNT(*) INTO v_has_responses
      FROM tkr_cuestionario_respuesta
      WHERE id_cuestionario = v_id;
    END IF;

    -- Always update the existing questionnaire in place
    IF v_id IS NOT NULL THEN
        UPDATE tkr_cuestionarios
        SET nombre = v_nombre,
            descripcion = v_descripcion,
            publicado = v_publicado,
            id_tipo_cuestionario = v_id_tipo_cuestionario,
            presentacion_unica = v_presentacion_unica,
            fecha_publicacion = CASE WHEN v_publicado = 1 AND publicado = 0 THEN SYSDATE ELSE fecha_publicacion END
        WHERE id = v_id;
        v_cuest_id := v_id;

        -- Clean up previous child entities (orden respetando FKs)
        -- 1. tkr_rangos_interpretacion: FK -> tkr_variables_calculadas y tkr_cuestionarios
        DELETE FROM tkr_rangos_interpretacion WHERE id_cuestionario = v_cuest_id;
        -- 2. tkr_resultados_cuestionario: hijo directo de tkr_cuestionarios
        DELETE FROM tkr_resultados_cuestionario WHERE id_cuestionario = v_cuest_id;
        -- 3. tkr_variables_calculadas_det: FK -> tkr_variables_calculadas y tkr_preguntas
        DELETE FROM tkr_variables_calculadas_det WHERE id_variable_calculada IN (
          SELECT id FROM tkr_variables_calculadas WHERE id_cuestionario = v_cuest_id
        );
        -- 4. tkr_variables_calculadas: ahora libre de hijos
        DELETE FROM tkr_variables_calculadas WHERE id_cuestionario = v_cuest_id;
        -- 5. tkr_reglas_flujo: FK -> tkr_flujos_pregunta
        DELETE FROM tkr_reglas_flujo WHERE id_flujo_pregunta IN (
          SELECT fp.id FROM tkr_flujos_pregunta fp, tkr_preguntas p
          WHERE fp.id_pregunta_origen = p.id AND p.id_cuestionario = v_cuest_id
        );
        -- 6. tkr_flujos_pregunta: FK -> tkr_preguntas
        DELETE FROM tkr_flujos_pregunta WHERE id_pregunta_origen IN (
          SELECT id FROM tkr_preguntas WHERE id_cuestionario = v_cuest_id
        );
        -- 7. Hijos directos de tkr_preguntas
        DELETE FROM tkr_pregunta_asociativa WHERE id_pregunta IN (
          SELECT id FROM tkr_preguntas WHERE id_cuestionario = v_cuest_id
        );
        DELETE FROM tkr_opciones_pregunta WHERE id_pregunta IN (
          SELECT id FROM tkr_preguntas WHERE id_cuestionario = v_cuest_id
        );
        -- 8. tkr_preguntas: ahora libre de hijos
        DELETE FROM tkr_preguntas WHERE id_cuestionario = v_cuest_id;
        -- 9. tkr_secciones_cuestionario: ahora libre de hijos (preguntas ya eliminadas)
        DELETE FROM tkr_secciones_cuestionario WHERE id_cuestionario = v_cuest_id;
    ELSE
        INSERT INTO tkr_cuestionarios (
          nombre, descripcion, version, publicado, id_tipo_cuestionario, presentacion_unica, fecha_creacion, estado
        ) VALUES (
          v_nombre, v_descripcion, v_version, v_publicado, v_id_tipo_cuestionario, v_presentacion_unica, SYSDATE, 1
        ) RETURNING id INTO v_cuest_id;
    END IF;

    -- Process Sections & Questions
    IF v_input_obj.has('secciones') AND NOT v_input_obj.get('secciones').is_null THEN
      v_secciones := v_input_obj.get_array('secciones');
      v_sec_count := v_secciones.get_size;
    ELSE
      v_sec_count := 0;
    END IF;
    
    IF v_sec_count > 0 THEN
      FOR v_sec_idx IN 0 .. v_sec_count - 1 LOOP
        v_seccion := JSON_OBJECT_T(v_secciones.get(v_sec_idx));
        v_sec_nombre := v_seccion.get_string('nombre');
        v_sec_desc := v_seccion.get_string('descripcion');
        v_sec_orden := v_seccion.get_number('orden_visual');

        INSERT INTO tkr_secciones_cuestionario (
          id_cuestionario, nombre, descripcion, orden_visual, estado
        ) VALUES (
          v_cuest_id, v_sec_nombre, v_sec_desc, v_sec_orden, 1
        ) RETURNING id INTO v_sec_id;

        -- Process Questions of this section
        IF v_seccion.has('preguntas') AND NOT v_seccion.get('preguntas').is_null THEN
          v_preguntas := v_seccion.get_array('preguntas');
          v_preg_count := v_preguntas.get_size;
        ELSE
          v_preg_count := 0;
        END IF;
        
        FOR v_preg_idx IN 0 .. v_preg_count - 1 LOOP
          v_pregunta := JSON_OBJECT_T(v_preguntas.get(v_preg_idx));
          v_preg_tipo_cod := v_pregunta.get_string('tipo_codigo');
          v_preg_codigo := v_pregunta.get_string('codigo');
          v_preg_texto := v_pregunta.get_string('texto_pregunta');
          v_preg_orden := v_pregunta.get_number('orden_visual');
          v_preg_oblig := NVL(v_pregunta.get_number('obligatoria'), 0);
          v_preg_valor := NVL(v_pregunta.get_number('valor_pregunta'), 0);
          v_preg_otro := NVL(v_pregunta.get_number('permite_otro'), 0);

          -- Get ID of type question
          BEGIN
            SELECT id INTO v_preg_tipo_id FROM tkr_tipos_pregunta WHERE codigo = v_preg_tipo_cod;
          EXCEPTION
            WHEN NO_DATA_FOUND THEN v_preg_tipo_id := 1; -- Fallback UNICA
          END;

          INSERT INTO tkr_preguntas (
            id_cuestionario, id_seccion_cuestionario, id_tipo_pregunta, codigo, texto_pregunta, orden_visual, obligatoria, valor_pregunta, permite_otro, estado
          ) VALUES (
            v_cuest_id, v_sec_id, v_preg_tipo_id, v_preg_codigo, v_preg_texto, v_preg_orden, v_preg_oblig, v_preg_valor, v_preg_otro, 1
          ) RETURNING id INTO v_preg_id;

          -- Save mapping from old question ID to new question ID
          IF v_pregunta.has('id') AND NOT v_pregunta.get('id').is_null THEN
            v_preg_id_map(TO_CHAR(v_pregunta.get_number('id'))) := v_preg_id;
          END IF;

          -- Process Options of Question
          IF v_pregunta.has('opciones') AND NOT v_pregunta.get('opciones').is_null THEN
            v_opciones := v_pregunta.get_array('opciones');
            v_op_count := v_opciones.get_size;
          ELSE
            v_op_count := 0;
          END IF;
          
          FOR v_op_idx IN 0 .. v_op_count - 1 LOOP
            v_opcion := JSON_OBJECT_T(v_opciones.get(v_op_idx));
            v_op_texto := v_opcion.get_string('texto_opcion');
            v_op_codigo := v_opcion.get_string('codigo_opcion');
            v_op_orden := v_opcion.get_number('orden_visual');
            v_op_valor := NVL(v_opcion.get_number('valor_opcion'), 0);

            INSERT INTO tkr_opciones_pregunta (
              id_pregunta, texto_opcion, codigo_opcion, orden_visual, valor_opcion, estado
            ) VALUES (
              v_preg_id, v_op_texto, v_op_codigo, v_op_orden, v_op_valor, 1
            );
          END LOOP;

          -- Process Associations of Question
          IF v_pregunta.has('asociaciones') AND NOT v_pregunta.get('asociaciones').is_null THEN
            v_asociaciones := v_pregunta.get_array('asociaciones');
            v_assoc_count := v_asociaciones.get_size;
          ELSE
            v_assoc_count := 0;
          END IF;
          
          FOR v_assoc_idx IN 0 .. v_assoc_count - 1 LOOP
            v_asociacion := JSON_OBJECT_T(v_asociaciones.get(v_assoc_idx));
            v_assoc_izq := v_asociacion.get_string('item_izquierdo');
            v_assoc_der := v_asociacion.get_string('item_derecho');
            v_assoc_val := NVL(v_asociacion.get_number('valor_correcto'), 0);

            INSERT INTO tkr_pregunta_asociativa (
              id_pregunta, item_izquierdo, item_derecho, valor_correcto, estado
            ) VALUES (
              v_preg_id, v_assoc_izq, v_assoc_der, v_assoc_val, 1
            );
          END LOOP;
        END LOOP;
      END LOOP;
    END IF;

    -- Process Flows & Rules (using codes to lookup IDs)
    IF v_input_obj.has('flujos') AND NOT v_input_obj.get('flujos').is_null THEN
      v_flujos := v_input_obj.get_array('flujos');
      v_flujo_count := v_flujos.get_size;
    ELSE
      v_flujo_count := 0;
    END IF;
    
    FOR v_flujo_idx IN 0 .. v_flujo_count - 1 LOOP
      v_flujo := JSON_OBJECT_T(v_flujos.get(v_flujo_idx));
      v_flujo_orig_cod := v_flujo.get_string('codigo_pregunta_origen');
      v_flujo_op_cod := v_flujo.get_string('codigo_opcion_respuesta');
      v_flujo_oper_cod := v_flujo.get_string('operador_codigo');
      v_flujo_comparacion := v_flujo.get_string('valor_comparacion');
      v_flujo_dest_cod := v_flujo.get_string('codigo_pregunta_destino');
      v_flujo_prioridad := NVL(v_flujo.get_number('prioridad'), 1);

      -- Find origin question ID
      BEGIN
        SELECT id INTO v_flujo_orig_id FROM tkr_preguntas WHERE id_cuestionario = v_cuest_id AND codigo = v_flujo_orig_cod;
      EXCEPTION WHEN NO_DATA_FOUND THEN v_flujo_orig_id := NULL; END;

      -- Find destination question ID
      BEGIN
        SELECT id INTO v_flujo_dest_id FROM tkr_preguntas WHERE id_cuestionario = v_cuest_id AND codigo = v_flujo_dest_cod;
      EXCEPTION WHEN NO_DATA_FOUND THEN v_flujo_dest_id := NULL; END;

      -- Find option ID
      v_flujo_op_id := NULL;
      IF v_flujo_orig_id IS NOT NULL AND v_flujo_op_cod IS NOT NULL THEN
        BEGIN
          SELECT id INTO v_flujo_op_id FROM tkr_opciones_pregunta WHERE id_pregunta = v_flujo_orig_id AND codigo_opcion = v_flujo_op_cod;
        EXCEPTION WHEN NO_DATA_FOUND THEN v_flujo_op_id := NULL; END;
      END IF;

      -- Find operator ID
      v_flujo_oper_id := NULL;
      IF v_flujo_oper_cod IS NOT NULL THEN
        BEGIN
          SELECT id INTO v_flujo_oper_id FROM tkr_operadores WHERE codigo = v_flujo_oper_cod;
        EXCEPTION WHEN NO_DATA_FOUND THEN 
          INSERT INTO tkr_operadores (codigo, descripcion, estado) VALUES (v_flujo_oper_cod, 'Operador ' || v_flujo_oper_cod, 1) RETURNING id INTO v_flujo_oper_id;
        END;
      END IF;

      IF v_flujo_orig_id IS NOT NULL AND v_flujo_dest_id IS NOT NULL THEN
        INSERT INTO tkr_flujos_pregunta (
          id_pregunta_origen, id_opcion_respuesta, id_operador, valor_comparacion, id_pregunta_destino, prioridad, estado
        ) VALUES (
          v_flujo_orig_id, v_flujo_op_id, v_flujo_oper_id, v_flujo_comparacion, v_flujo_dest_id, v_flujo_prioridad, 1
        ) RETURNING id INTO v_flujo_id;

        -- Process Rules of this Flow
        IF v_flujo.has('reglas') AND NOT v_flujo.get('reglas').is_null THEN
          v_reglas := v_flujo.get_array('reglas');
          v_reglas_count := v_reglas.get_size;
        ELSE
          v_reglas_count := 0;
        END IF;
        
        FOR v_reglas_idx IN 0 .. v_reglas_count - 1 LOOP
          v_regla := JSON_OBJECT_T(v_reglas.get(v_reglas_idx));
          v_regla_campo := v_regla.get_string('campo_evaluado');
          v_regla_oper := v_regla.get_string('operador');
          v_regla_esp := v_regla.get_string('valor_esperado');
          v_regla_agrup := v_regla.get_string('agrupador');

          INSERT INTO tkr_reglas_flujo (
            id_flujo_pregunta, campo_evaluado, operador, valor_esperado, agrupador, estado
          ) VALUES (
            v_flujo_id, v_regla_campo, v_regla_oper, v_regla_esp, v_regla_agrup, 1
          );
        END LOOP;
      END IF;
    END LOOP;

    -- Process Variables Clínicas (calculated variables)
    IF v_input_obj.has('variables') AND NOT v_input_obj.get('variables').is_null THEN
      v_vars_calc := v_input_obj.get_array('variables');
      IF v_vars_calc IS NOT NULL THEN
        FOR i IN 0 .. v_vars_calc.get_size - 1 LOOP
          v_var_calc := JSON_OBJECT_T(v_vars_calc.get(i));
          v_var_codigo := v_var_calc.get_string('codigo');
          v_var_nombre := v_var_calc.get_string('nombre');
          v_var_desc := v_var_calc.get_string('descripcion');
          v_var_formula := v_var_calc.get_string('formula_calculo');
          
          IF v_var_calc.has('valor_minimo') AND NOT v_var_calc.get('valor_minimo').is_null THEN
            v_var_min := v_var_calc.get_number('valor_minimo');
          ELSE
            v_var_min := NULL;
          END IF;
          
          IF v_var_calc.has('valor_maximo') AND NOT v_var_calc.get('valor_maximo').is_null THEN
            v_var_max := v_var_calc.get_number('valor_maximo');
          ELSE
            v_var_max := NULL;
          END IF;
          
          v_var_unidad := v_var_calc.get_string('unidad_medida');
          v_var_orden := NVL(v_var_calc.get_number('orden_visual'), 1);
          
          DECLARE
            v_new_var_id NUMBER;
          BEGIN
            INSERT INTO tkr_variables_calculadas (
              id_cuestionario, codigo, nombre, descripcion, formula_calculo, valor_minimo, valor_maximo, unidad_medida, orden_visual, estado, fecha_creacion
            ) VALUES (
              v_cuest_id, v_var_codigo, v_var_nombre, v_var_desc, v_var_formula, v_var_min, v_var_max, v_var_unidad, v_var_orden, 1, SYSDATE
            ) RETURNING id INTO v_new_var_id;
            
            -- Process detail questions weight
            IF v_var_calc.has('preguntas_asociadas') AND NOT v_var_calc.get('preguntas_asociadas').is_null THEN
              v_dets_calc := v_var_calc.get_array('preguntas_asociadas');
              IF v_dets_calc IS NOT NULL THEN
                FOR j IN 0 .. v_dets_calc.get_size - 1 LOOP
                  v_det_calc := JSON_OBJECT_T(v_dets_calc.get(j));
                  v_det_preg_id := v_det_calc.get_number('id_pregunta');
                  v_det_peso := NVL(v_det_calc.get_number('peso'), 1);
                  v_det_orden := NVL(v_det_calc.get_number('orden_visual'), 1);
                  
                  -- Map question ID using the mapping array
                  IF v_preg_id_map.EXISTS(TO_CHAR(v_det_preg_id)) THEN
                    v_det_preg_id := v_preg_id_map(TO_CHAR(v_det_preg_id));
                  END IF;
                  
                  INSERT INTO tkr_variables_calculadas_det (
                    id_variable_calculada, id_pregunta, peso, orden_visual, estado
                  ) VALUES (
                    v_new_var_id, v_det_preg_id, v_det_peso, v_det_orden, 1
                  );
                END LOOP;
              END IF;
            END IF;
          END;
        END LOOP;
      END IF;
    END IF;

    -- Process Rangos Clínicos (interpretations)
    IF v_input_obj.has('resultados_clinicos') AND NOT v_input_obj.get('resultados_clinicos').is_null THEN
      v_rangos_clinicos := v_input_obj.get_array('resultados_clinicos');
      IF v_rangos_clinicos IS NOT NULL THEN
        FOR i IN 0 .. v_rangos_clinicos.get_size - 1 LOOP
          v_rango_clinico := JSON_OBJECT_T(v_rangos_clinicos.get(i));
          v_r_nombre := v_rango_clinico.get_string('nombre_rango');
          v_r_desc := v_rango_clinico.get_string('descripcion');
          v_r_min := v_rango_clinico.get_number('valor_minimo');
          v_r_max := v_rango_clinico.get_number('valor_maximo');
          v_r_clasif := v_rango_clinico.get_string('clasificacion');
          v_r_color := v_rango_clinico.get_string('color_visual');
          v_r_orden := NVL(v_rango_clinico.get_number('orden_visual'), 1);
          
          -- Resolve id_variable_calculada using code lookup
          DECLARE
            v_r_var_id_old NUMBER;
            v_r_var_id NUMBER := NULL;
          BEGIN
            IF v_rango_clinico.has('id_variable_calculada') AND NOT v_rango_clinico.get('id_variable_calculada').is_null THEN
              v_r_var_id_old := v_rango_clinico.get_number('id_variable_calculada');
              IF v_r_var_id_old IS NOT NULL AND v_vars_calc IS NOT NULL THEN
                FOR k IN 0 .. v_vars_calc.get_size - 1 LOOP
                  DECLARE
                    v_vc_temp JSON_OBJECT_T := JSON_OBJECT_T(v_vars_calc.get(k));
                    v_vc_id_temp NUMBER := v_vc_temp.get_number('id');
                    v_vc_cod_temp VARCHAR2(100) := v_vc_temp.get_string('codigo');
                  BEGIN
                    IF v_vc_id_temp = v_r_var_id_old THEN
                      BEGIN
                        SELECT id INTO v_r_var_id
                        FROM tkr_variables_calculadas
                        WHERE id_cuestionario = v_cuest_id AND codigo = v_vc_cod_temp AND estado = 1;
                      EXCEPTION WHEN NO_DATA_FOUND THEN
                        v_r_var_id := NULL;
                      END;
                      EXIT;
                    END IF;
                  END;
                END LOOP;
              END IF;
            END IF;
            
            INSERT INTO tkr_rangos_interpretacion (
              id_cuestionario, nombre_rango, descripcion, valor_minimo, valor_maximo, clasificacion, color_visual, orden_visual, id_variable_calculada, estado, fecha_creacion
            ) VALUES (
              v_cuest_id, v_r_nombre, v_r_desc, v_r_min, v_r_max, v_r_clasif, v_r_color, v_r_orden, v_r_var_id, 1, SYSDATE
            );
          END;
        END LOOP;
      END IF;
    END IF;

    -- Process Resultados Clasificacion (general)
    IF v_input_obj.has('resultados') AND NOT v_input_obj.get('resultados').is_null THEN
      v_resultados := v_input_obj.get_array('resultados');
      v_res_idx := v_resultados.get_size;
    ELSE
      v_res_idx := 0;
    END IF;
    
    FOR i IN 0 .. v_res_idx - 1 LOOP
      v_resultado := JSON_OBJECT_T(v_resultados.get(i));
      v_res_desde := v_resultado.get_number('puntaje_desde');
      v_res_hasta := v_resultado.get_number('puntaje_hasta');
      v_res_nombre := v_resultado.get_string('nombre_resultado');
      v_res_desc := v_resultado.get_string('descripcion');
      v_res_color := v_resultado.get_string('color');

      IF v_res_nombre IS NOT NULL THEN
        INSERT INTO tkr_resultados_cuestionario (
          id_cuestionario, puntaje_desde, puntaje_hasta, nombre_resultado, descripcion, color, estado
        ) VALUES (
          v_cuest_id, v_res_desde, v_res_hasta, v_res_nombre, v_res_desc, v_res_color, 1
        );
      END IF;
    END LOOP;

    COMMIT;
    p_output := '{"success":true,"id":' || v_cuest_id || ',"version":' || v_version || '}';
  EXCEPTION
    WHEN OTHERS THEN
      ROLLBACK;
      p_success := 0;
      p_output := '{"success":false,"error":"' || REPLACE(SQLERRM, '"', '\"') || '"}';
  END sp_guardar_cuestionario;

  -- 4. Change status (publish, draft or soft-delete)
  PROCEDURE sp_cambiar_estado_cuestionario(
    p_input   IN  CLOB,
    p_output  OUT CLOB,
    p_success OUT NUMBER
  ) AS
    v_id NUMBER;
    v_accion VARCHAR2(30); -- 'publish', 'draft', 'delete'
  BEGIN
    p_success := 1;
    v_id := JSON_VALUE(p_input, '$.id' RETURNING NUMBER);
    v_accion := JSON_VALUE(p_input, '$.accion');

    IF v_id IS NULL OR v_accion IS NULL THEN
      p_success := 0;
      p_output := '{"success":false,"error":"Parámetros id y accion son requeridos"}';
      RETURN;
    END IF;

    IF v_accion = 'publish' THEN
      -- Archive old versions first
      DECLARE
        v_nombre VARCHAR2(500);
      BEGIN
        SELECT nombre INTO v_nombre FROM tkr_cuestionarios WHERE id = v_id;
        
        -- Unpublish other versions
        UPDATE tkr_cuestionarios
        SET publicado = 0
        WHERE nombre = v_nombre AND id != v_id;
      EXCEPTION WHEN OTHERS THEN NULL;
      END;

      UPDATE tkr_cuestionarios
      SET publicado = 1,
          fecha_publicacion = SYSDATE
      WHERE id = v_id;
    ELSIF v_accion = 'draft' THEN
      UPDATE tkr_cuestionarios
      SET publicado = 0
      WHERE id = v_id;
    ELSIF v_accion = 'delete' THEN
      UPDATE tkr_cuestionarios
      SET estado = 0
      WHERE id = v_id;
    ELSE
      p_success := 0;
      p_output := '{"success":false,"error":"Acción no soportada. Usar: publish, draft, delete"}';
      RETURN;
    END IF;

    COMMIT;
    p_output := '{"success":true,"id":' || v_id || ',"accion":"' || v_accion || '"}';
  EXCEPTION
    WHEN OTHERS THEN
      ROLLBACK;
      p_success := 0;
      p_output := '{"success":false,"error":"' || REPLACE(SQLERRM, '"', '\"') || '"}';
  END sp_cambiar_estado_cuestionario;

  -- 5. Duplicate a questionnaire with all its questions, sections, options, and rules
  PROCEDURE sp_duplicar_cuestionario(
    p_input   IN  CLOB,
    p_output  OUT CLOB,
    p_success OUT NUMBER
  ) AS
    v_id NUMBER;
    v_new_nombre VARCHAR2(500);
    v_new_cuest_id NUMBER;
    v_descripcion CLOB;
    v_orig_nombre VARCHAR2(500);
    v_orig_version NUMBER;
    v_orig_tipo_cuestionario NUMBER;
    v_orig_presentacion_unica NUMBER(1);
    v_new_version NUMBER;
    v_base_nombre VARCHAR2(500);
    v_new_nombre_generated VARCHAR2(500);
  BEGIN
    p_success := 1;
    v_id := JSON_VALUE(p_input, '$.id' RETURNING NUMBER);
    v_new_nombre := JSON_VALUE(p_input, '$.nuevo_nombre');

    IF v_id IS NULL THEN
      p_success := 0;
      p_output := '{"success":false,"error":"Parámetro id es requerido"}';
      RETURN;
    END IF;

    -- Retrieve source questionnaire details
    SELECT nombre, descripcion, version, id_tipo_cuestionario, presentacion_unica
    INTO v_orig_nombre, v_descripcion, v_orig_version, v_orig_tipo_cuestionario, v_orig_presentacion_unica
    FROM tkr_cuestionarios
    WHERE id = v_id;

    v_new_version := v_orig_version + 1;
    v_base_nombre := REGEXP_REPLACE(v_orig_nombre, '\s+version\s+[0-9]+$', '', 1, 0, 'i');
    v_new_nombre_generated := v_base_nombre || ' version ' || v_new_version;

    -- Create duplicate questionnaire entry
    INSERT INTO tkr_cuestionarios (
      nombre, descripcion, version, publicado, id_tipo_cuestionario, presentacion_unica, fecha_creacion, estado
    ) VALUES (
      NVL(v_new_nombre, v_new_nombre_generated), v_descripcion, v_new_version, 0, v_orig_tipo_cuestionario, v_orig_presentacion_unica, SYSDATE, 1
    ) RETURNING id INTO v_new_cuest_id;

    -- Duplicate sections and maintain association maps
    FOR s IN (
      SELECT id, nombre, descripcion, orden_visual
      FROM tkr_secciones_cuestionario
      WHERE id_cuestionario = v_id AND estado = 1
      ORDER BY orden_visual
    ) LOOP
      DECLARE
        v_new_sec_id NUMBER;
      BEGIN
        INSERT INTO tkr_secciones_cuestionario (
          id_cuestionario, nombre, descripcion, orden_visual, estado
        ) VALUES (
          v_new_cuest_id, s.nombre, s.descripcion, s.orden_visual, 1
        ) RETURNING id INTO v_new_sec_id;

        -- Duplicate questions in section
        FOR q IN (
          SELECT id, id_tipo_pregunta, codigo, texto_pregunta, orden_visual, obligatoria, valor_pregunta, permite_otro
          FROM tkr_preguntas
          WHERE id_seccion_cuestionario = s.id AND estado = 1
          ORDER BY orden_visual
        ) LOOP
          DECLARE
            v_new_preg_id NUMBER;
          BEGIN
            INSERT INTO tkr_preguntas (
              id_cuestionario, id_seccion_cuestionario, id_tipo_pregunta, codigo, texto_pregunta, orden_visual, obligatoria, valor_pregunta, permite_otro, estado
            ) VALUES (
              v_new_cuest_id, v_new_sec_id, q.id_tipo_pregunta, q.codigo, q.texto_pregunta, q.orden_visual, q.obligatoria, q.valor_pregunta, q.permite_otro, 1
            ) RETURNING id INTO v_new_preg_id;

            -- Duplicate options
            INSERT INTO tkr_opciones_pregunta (id_pregunta, texto_opcion, codigo_opcion, orden_visual, valor_opcion, estado)
            SELECT v_new_preg_id, texto_opcion, codigo_opcion, orden_visual, valor_opcion, 1
            FROM tkr_opciones_pregunta
            WHERE id_pregunta = q.id AND estado = 1;

            -- Duplicate associative fields
            INSERT INTO tkr_pregunta_asociativa (id_pregunta, item_izquierdo, item_derecho, valor_correcto, estado)
            SELECT v_new_preg_id, item_izquierdo, item_derecho, valor_correcto, 1
            FROM tkr_pregunta_asociativa
            WHERE id_pregunta = q.id AND estado = 1;
          END;
        END LOOP;
      END;
    END LOOP;

    -- Duplicate logical flows and rules
    FOR fp IN (
      SELECT f.id, qo.codigo as orig_cod, qd.codigo as dest_cod, op.codigo_opcion as op_cod, f.id_operador, f.valor_comparacion, f.prioridad
      FROM tkr_flujos_pregunta f
      JOIN tkr_preguntas qo ON f.id_pregunta_origen = qo.id
      JOIN tkr_preguntas qd ON f.id_pregunta_destino = qd.id
      LEFT JOIN tkr_opciones_pregunta op ON f.id_opcion_respuesta = op.id
      WHERE qo.id_cuestionario = v_id AND f.estado = 1
    ) LOOP
      DECLARE
        v_orig_id NUMBER;
        v_dest_id NUMBER;
        v_op_id NUMBER := NULL;
        v_new_flujo_id NUMBER;
      BEGIN
        SELECT id INTO v_orig_id FROM tkr_preguntas WHERE id_cuestionario = v_new_cuest_id AND codigo = fp.orig_cod;
        SELECT id INTO v_dest_id FROM tkr_preguntas WHERE id_cuestionario = v_new_cuest_id AND codigo = fp.dest_cod;
        
        IF fp.op_cod IS NOT NULL THEN
          SELECT id INTO v_op_id FROM tkr_opciones_pregunta WHERE id_pregunta = v_orig_id AND codigo_opcion = fp.op_cod;
        END IF;

        INSERT INTO tkr_flujos_pregunta (
          id_pregunta_origen, id_opcion_respuesta, id_operador, valor_comparacion, id_pregunta_destino, prioridad, estado
        ) VALUES (
          v_orig_id, v_op_id, fp.id_operador, fp.valor_comparacion, v_dest_id, fp.prioridad, 1
        ) RETURNING id INTO v_new_flujo_id;

        -- Duplicate rules of flow
        INSERT INTO tkr_reglas_flujo (id_flujo_pregunta, campo_evaluado, operador, valor_esperado, agrupador, estado)
        SELECT v_new_flujo_id, campo_evaluado, operador, valor_esperado, agrupador, 1
        FROM tkr_reglas_flujo
        WHERE id_flujo_pregunta = fp.id AND estado = 1;
      EXCEPTION WHEN OTHERS THEN NULL; -- Skip if lookups fail
      END;
    END LOOP;

    -- Duplicate clinical variables
    FOR vc IN (
      SELECT id, codigo, nombre, descripcion, formula_calculo, valor_minimo, valor_maximo, unidad_medida, orden_visual
      FROM tkr_variables_calculadas
      WHERE id_cuestionario = v_id AND estado = 1
    ) LOOP
      DECLARE
        v_new_vc_id NUMBER;
      BEGIN
        INSERT INTO tkr_variables_calculadas (
          id_cuestionario, codigo, nombre, descripcion, formula_calculo, valor_minimo, valor_maximo, unidad_medida, orden_visual, estado, fecha_creacion
        ) VALUES (
          v_new_cuest_id, vc.codigo, vc.nombre, vc.descripcion, vc.formula_calculo, vc.valor_minimo, vc.valor_maximo, vc.unidad_medida, vc.orden_visual, 1, SYSDATE
        ) RETURNING id INTO v_new_vc_id;
        
        -- Duplicate questions weight detail
        FOR d IN (
          SELECT id_pregunta, peso, orden_visual
          FROM tkr_variables_calculadas_det
          WHERE id_variable_calculada = vc.id AND estado = 1
        ) LOOP
          DECLARE
            v_orig_q_code VARCHAR2(100);
            v_new_q_id NUMBER;
          BEGIN
            SELECT codigo INTO v_orig_q_code FROM tkr_preguntas WHERE id = d.id_pregunta;
            SELECT id INTO v_new_q_id FROM tkr_preguntas WHERE id_cuestionario = v_new_cuest_id AND codigo = v_orig_q_code;
            
            INSERT INTO tkr_variables_calculadas_det (
              id_variable_calculada, id_pregunta, peso, orden_visual, estado
            ) VALUES (
              v_new_vc_id, v_new_q_id, d.peso, d.orden_visual, 1
            );
          EXCEPTION WHEN OTHERS THEN NULL;
          END;
        END LOOP;
      END;
    END LOOP;

    -- Duplicate clinical interpretation ranges
    FOR ri IN (
      SELECT id, nombre_rango, descripcion, valor_minimo, valor_maximo, clasificacion, color_visual, orden_visual, id_variable_calculada
      FROM tkr_rangos_interpretacion
      WHERE id_cuestionario = v_id AND estado = 1
    ) LOOP
      DECLARE
        v_new_var_id NUMBER := NULL;
        v_old_var_code VARCHAR2(100) := NULL;
      BEGIN
        IF ri.id_variable_calculada IS NOT NULL THEN
          SELECT codigo INTO v_old_var_code 
          FROM tkr_variables_calculadas 
          WHERE id = ri.id_variable_calculada;
          
          SELECT id INTO v_new_var_id 
          FROM tkr_variables_calculadas 
          WHERE id_cuestionario = v_new_cuest_id AND codigo = v_old_var_code AND estado = 1;
        END IF;
        
        INSERT INTO tkr_rangos_interpretacion (
          id_cuestionario, nombre_rango, descripcion, valor_minimo, valor_maximo, clasificacion, color_visual, orden_visual, id_variable_calculada, estado, fecha_creacion
        ) VALUES (
          v_new_cuest_id, ri.nombre_rango, ri.descripcion, ri.valor_minimo, ri.valor_maximo, ri.clasificacion, ri.color_visual, ri.orden_visual, v_new_var_id, 1, SYSDATE
        );
      EXCEPTION WHEN OTHERS THEN
        INSERT INTO tkr_rangos_interpretacion (
          id_cuestionario, nombre_rango, descripcion, valor_minimo, valor_maximo, clasificacion, color_visual, orden_visual, id_variable_calculada, estado, fecha_creacion
        ) VALUES (
          v_new_cuest_id, ri.nombre_rango, ri.descripcion, ri.valor_minimo, ri.valor_maximo, ri.clasificacion, ri.color_visual, ri.orden_visual, NULL, 1, SYSDATE
        );
      END;
    END LOOP;

    -- Duplicate results classifications (general)
    INSERT INTO tkr_resultados_cuestionario (
      id_cuestionario, puntaje_desde, puntaje_hasta, nombre_resultado, descripcion, color, estado
    )
    SELECT v_new_cuest_id, puntaje_desde, puntaje_hasta, nombre_resultado, descripcion, color, 1
    FROM tkr_resultados_cuestionario
    WHERE id_cuestionario = v_id AND estado = 1;

    COMMIT;
    p_output := '{"success":true,"id":' || v_new_cuest_id || '}';
  EXCEPTION
    WHEN OTHERS THEN
      ROLLBACK;
      p_success := 0;
      p_output := '{"success":false,"error":"' || REPLACE(SQLERRM, '"', '\"') || '"}';
  END sp_duplicar_cuestionario;

  -- 6. Start a questionnaire response instance
  PROCEDURE sp_iniciar_respuesta(
    p_input   IN  CLOB,
    p_output  OUT CLOB,
    p_success OUT NUMBER
  ) AS
    v_id_cuestionario NUMBER;
    v_id_usuario NUMBER;
    v_resp_id NUMBER;
  BEGIN
    p_success := 1;
    v_id_cuestionario := JSON_VALUE(p_input, '$.id_cuestionario' RETURNING NUMBER);
    v_id_usuario := JSON_VALUE(p_input, '$.id_usuario' RETURNING NUMBER);

    IF v_id_cuestionario IS NULL THEN
      p_success := 0;
      p_output := '{"success":false,"error":"Parámetro id_cuestionario es requerido"}';
      RETURN;
    END IF;

    -- Si es una sesión de previsualización (id_usuario IS NULL),
    -- borrar sesiones anteriores de preview para este cuestionario para evitar acumulación de datos
    IF v_id_usuario IS NULL THEN
      DELETE FROM tkr_respuesta_opciones
      WHERE id_respuesta IN (
        SELECT r.id FROM tkr_respuestas r
        JOIN tkr_cuestionario_respuesta cr ON r.id_cuestionario_respuesta = cr.id
        WHERE cr.id_cuestionario = v_id_cuestionario AND cr.id_usuario IS NULL
      );
      DELETE FROM tkr_respuestas
      WHERE id_cuestionario_respuesta IN (
        SELECT id FROM tkr_cuestionario_respuesta
        WHERE id_cuestionario = v_id_cuestionario AND id_usuario IS NULL
      );
      DELETE FROM tkr_cuestionario_respuesta
      WHERE id_cuestionario = v_id_cuestionario AND id_usuario IS NULL;
    END IF;

    -- Insert into responses instance tracker
    INSERT INTO tkr_cuestionario_respuesta (
      id_cuestionario, id_usuario, fecha_inicio, estado
    ) VALUES (
      v_id_cuestionario, v_id_usuario, SYSDATE, 0 -- 0 = draft / in progress
    ) RETURNING id INTO v_resp_id;

    COMMIT;
    p_output := '{"success":true,"id_cuestionario_respuesta":' || v_resp_id || '}';
  EXCEPTION
    WHEN OTHERS THEN
      ROLLBACK;
      p_success := 0;
      p_output := '{"success":false,"error":"' || REPLACE(SQLERRM, '"', '\"') || '"}';
  END sp_iniciar_respuesta;

  -- 7. Save answers
  PROCEDURE sp_guardar_respuestas(
    p_input   IN  CLOB,
    p_output  OUT CLOB,
    p_success OUT NUMBER
  ) AS
    v_resp_id NUMBER;
    v_ans_count NUMBER;
    v_ans_idx NUMBER;
    v_preg_id NUMBER;
    v_texto CLOB;
    v_numero NUMBER;
    v_fecha DATE;
    v_fecha_str VARCHAR2(100);
    v_valor_obt NUMBER;
    v_ans_id NUMBER;
    v_op_count NUMBER;
    v_op_idx NUMBER;
    v_op_id NUMBER;
    v_op_val NUMBER;

    -- Native JSON variables
    v_input_obj JSON_OBJECT_T;
    v_respuestas JSON_ARRAY_T;
    v_respuesta JSON_OBJECT_T;
    v_opciones JSON_ARRAY_T;
    v_opcion JSON_OBJECT_T;
  BEGIN
    p_success := 1;
    
    -- Parse root JSON object
    v_input_obj := JSON_OBJECT_T.parse(p_input);
    
    IF v_input_obj.has('id_cuestionario_respuesta') AND NOT v_input_obj.get('id_cuestionario_respuesta').is_null THEN
      v_resp_id := v_input_obj.get_number('id_cuestionario_respuesta');
    ELSE
      v_resp_id := NULL;
    END IF;

    IF v_resp_id IS NULL THEN
      p_success := 0;
      p_output := '{"success":false,"error":"Parámetro id_cuestionario_respuesta es requerido"}';
      RETURN;
    END IF;

    -- Get responses array
    IF v_input_obj.has('respuestas') AND NOT v_input_obj.get('respuestas').is_null THEN
      v_respuestas := v_input_obj.get_array('respuestas');
      v_ans_count := v_respuestas.get_size;
    ELSE
      v_ans_count := 0;
    END IF;
    
    FOR v_ans_idx IN 0 .. v_ans_count - 1 LOOP
      v_respuesta := JSON_OBJECT_T(v_respuestas.get(v_ans_idx));
      v_preg_id := v_respuesta.get_number('id_pregunta');
      v_texto := v_respuesta.get_string('respuesta_texto');
      v_numero := v_respuesta.get_number('respuesta_numero');
      v_fecha_str := v_respuesta.get_string('respuesta_fecha');
      v_valor_obt := NVL(v_respuesta.get_number('valor_obtenido'), 0);

      IF v_fecha_str IS NOT NULL THEN
        BEGIN
          v_fecha := TO_DATE(SUBSTR(v_fecha_str, 1, 10), 'YYYY-MM-DD');
        EXCEPTION WHEN OTHERS THEN v_fecha := NULL; END;
      ELSE
        v_fecha := NULL;
      END IF;

      -- Insert or update single question response
      BEGIN
        SELECT id INTO v_ans_id 
        FROM tkr_respuestas 
        WHERE id_cuestionario_respuesta = v_resp_id AND id_pregunta = v_preg_id;

        UPDATE tkr_respuestas
        SET respuesta_texto = v_texto,
            respuesta_numero = v_numero,
            respuesta_fecha = v_fecha,
            valor_obtenido = v_valor_obt
        WHERE id = v_ans_id;

        -- Clean up previous options for this answer
        DELETE FROM tkr_respuesta_opciones WHERE id_respuesta = v_ans_id;
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          INSERT INTO tkr_respuestas (
            id_cuestionario_respuesta, id_pregunta, respuesta_texto, respuesta_numero, respuesta_fecha, valor_obtenido, estado
          ) VALUES (
            v_resp_id, v_preg_id, v_texto, v_numero, v_fecha, v_valor_obt, 1
          ) RETURNING id INTO v_ans_id;
      END;

      -- Process sub-options for multiple/single select questions if present
      IF v_respuesta.has('opciones_seleccionadas') AND NOT v_respuesta.get('opciones_seleccionadas').is_null THEN
        v_opciones := v_respuesta.get_array('opciones_seleccionadas');
        v_op_count := v_opciones.get_size;
      ELSE
        v_op_count := 0;
      END IF;
      
      FOR v_op_idx IN 0 .. v_op_count - 1 LOOP
        v_opcion := JSON_OBJECT_T(v_opciones.get(v_op_idx));
        v_op_id := v_opcion.get_number('id_opcion');
        v_op_val := NVL(v_opcion.get_number('valor_obtenido'), 0);

        INSERT INTO tkr_respuesta_opciones (
          id_respuesta, id_opcion_pregunta, valor_obtenido, estado
        ) VALUES (
          v_ans_id, v_op_id, v_op_val, 1
        );
      END LOOP;
    END LOOP;

    COMMIT;
    p_output := '{"success":true,"id_cuestionario_respuesta":' || v_resp_id || '}';
  EXCEPTION
    WHEN OTHERS THEN
      ROLLBACK;
      p_success := 0;
      p_output := '{"success":false,"error":"' || REPLACE(SQLERRM, '"', '\"') || '"}';
  END sp_guardar_respuestas;

  -- 8. Finalize questionnaire response, calculate scores and classifications
  PROCEDURE sp_finalizar_cuestionario(
    p_input   IN  CLOB,
    p_output  OUT CLOB,
    p_success OUT NUMBER
  ) AS
    v_resp_id NUMBER;
    v_cuest_id NUMBER;
    v_tipo_cuestionario NUMBER;
    v_total_score NUMBER := 0;
    v_clasificacion VARCHAR2(500) := 'Sin Clasificar';
    v_color VARCHAR2(30) := 'grey';
    
    v_clob CLOB;
    v_primer_var BOOLEAN := TRUE;
  BEGIN
    p_success := 1;
    v_resp_id := JSON_VALUE(p_input, '$.id_cuestionario_respuesta' RETURNING NUMBER);

    IF v_resp_id IS NULL THEN
      p_success := 0;
      p_output := '{"success":false,"error":"Parámetro id_cuestionario_respuesta es requerido"}';
      RETURN;
    END IF;

    -- Fetch questionnaire ID and type
    SELECT cr.id_cuestionario, c.id_tipo_cuestionario 
    INTO v_cuest_id, v_tipo_cuestionario
    FROM tkr_cuestionario_respuesta cr
    JOIN tkr_cuestionarios c ON cr.id_cuestionario = c.id
    WHERE cr.id = v_resp_id;

    IF v_tipo_cuestionario = 2 THEN
      -- SALUD_MENTAL clinical evaluation
      DBMS_LOB.CREATETEMPORARY(v_clob, TRUE);
      DBMS_LOB.APPEND(v_clob, '{"success":true,"id_cuestionario_respuesta":' || v_resp_id || ',"resultados_clinicos":[');
      
      DECLARE
        v_header_score NUMBER := 0;
        v_header_clasif VARCHAR2(500) := 'Completado';
        v_header_color VARCHAR2(30) := 'green';
        v_is_first BOOLEAN := TRUE;
      BEGIN
        FOR v IN (
          SELECT id, codigo, nombre, descripcion, formula_calculo, valor_minimo, valor_maximo
          FROM tkr_variables_calculadas
          WHERE id_cuestionario = v_cuest_id AND estado = 1
          ORDER BY orden_visual
        ) LOOP
          DECLARE
            v_var_score NUMBER := 0;
            v_clasif VARCHAR2(500) := 'Sin Clasificar';
            v_color_vis VARCHAR2(30) := 'grey';
            v_r_desc VARCHAR2(1000) := '';
          BEGIN
            -- Clinical math: SUM(valor_obtenido * peso)
            SELECT NVL(SUM(r.valor_obtenido * d.peso), 0)
            INTO v_var_score
            FROM tkr_respuestas r
            JOIN tkr_variables_calculadas_det d ON r.id_pregunta = d.id_pregunta
            WHERE r.id_cuestionario_respuesta = v_resp_id
              AND d.id_variable_calculada = v.id
              AND r.estado = 1 AND d.estado = 1;

            -- Find corresponding clinical range
            BEGIN
              SELECT clasificacion, descripcion, color_visual
              INTO v_clasif, v_r_desc, v_color_vis
              FROM tkr_rangos_interpretacion
              WHERE id_cuestionario = v_cuest_id
                AND id_variable_calculada = v.id
                AND v_var_score BETWEEN valor_minimo AND valor_maximo
                AND estado = 1
                AND ROWNUM = 1;
            EXCEPTION
              WHEN NO_DATA_FOUND THEN
                v_clasif := 'Completado';
                v_r_desc := 'Puntaje de variable obtenido';
                v_color_vis := 'green';
            END;

            IF v_is_first THEN
              v_header_score := v_var_score;
              v_header_clasif := v_clasif;
              v_header_color := v_color_vis;
              v_is_first := FALSE;
            END IF;

            IF NOT v_primer_var THEN
              DBMS_LOB.APPEND(v_clob, ',');
            END IF;
            v_primer_var := FALSE;

            DBMS_LOB.APPEND(v_clob, '{"codigo":"' || f_escape_json(v.codigo) || '"' ||
              ',"nombre":"' || f_escape_json(v.nombre) || '"' ||
              ',"score":' || v_var_score ||
              ',"clasificacion":"' || f_escape_json(v_clasif) || '"' ||
              ',"descripcion":"' || f_escape_json(v_r_desc) || '"' ||
              ',"color_visual":"' || f_escape_json(v_color_vis) || '"}');
          END;
        END LOOP;
        
        DBMS_LOB.APPEND(v_clob, ']}');
        
        -- Update response header
        UPDATE tkr_cuestionario_respuesta
        SET fecha_fin = SYSDATE,
            puntaje_total = v_header_score,
            clasificacion_final = v_header_clasif,
            estado = 1
        WHERE id = v_resp_id;
        
        COMMIT;
        p_output := v_clob;
      END;
    ELSE
      -- Standard non-clinical questionnaire evaluation
      -- 1. Calculate Score from tkr_respuestas (which aggregates valor_obtenido)
      SELECT NVL(SUM(valor_obtenido), 0) INTO v_total_score
      FROM tkr_respuestas
      WHERE id_cuestionario_respuesta = v_resp_id;

      -- Also sum values from selected options
      DECLARE
        v_opts_score NUMBER;
      BEGIN
        SELECT NVL(SUM(ro.valor_obtenido), 0) INTO v_opts_score
        FROM tkr_respuesta_opciones ro, tkr_respuestas r
        WHERE ro.id_respuesta = r.id AND r.id_cuestionario_respuesta = v_resp_id;
        
        v_total_score := v_total_score + v_opts_score;
      END;

      -- 2. Find Classification range from tkr_resultados_cuestionario
      BEGIN
        SELECT nombre_resultado, color
        INTO v_clasificacion, v_color
        FROM tkr_resultados_cuestionario
        WHERE id_cuestionario = v_cuest_id
          AND v_total_score BETWEEN puntaje_desde AND puntaje_hasta
          AND estado = 1
          AND ROWNUM = 1;
      EXCEPTION
        WHEN NO_DATA_FOUND THEN
          BEGIN
            SELECT nombre_resultado, color INTO v_clasificacion, v_color
            FROM (
              SELECT nombre_resultado, color FROM tkr_resultados_cuestionario
              WHERE id_cuestionario = v_cuest_id AND estado = 1
              ORDER BY ABS(puntaje_desde - v_total_score)
            ) WHERE ROWNUM = 1;
          EXCEPTION WHEN OTHERS THEN
            v_clasificacion := 'Completado (Puntuación: ' || v_total_score || ')';
            v_color := 'green';
          END;
      END;

      UPDATE tkr_cuestionario_respuesta
      SET fecha_fin = SYSDATE,
          puntaje_total = v_total_score,
          clasificacion_final = v_clasificacion,
          estado = 1 -- 1 = Completed
      WHERE id = v_resp_id;

      COMMIT;
      p_output := '{"success":true,"id_cuestionario_respuesta":' || v_resp_id || 
        ',"puntaje_total":' || v_total_score || 
        ',"clasificacion_final":"' || f_escape_json(v_clasificacion) || '"' ||
        ',"color":"' || f_escape_json(v_color) || '"}';
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      ROLLBACK;
      p_success := 0;
      p_output := '{"success":false,"error":"' || REPLACE(SQLERRM, '"', '\"') || '"}';
  END sp_finalizar_cuestionario;

  -- 9. Get detail of a questionnaire response instance
  PROCEDURE sp_obtener_respuesta_detalle(
    p_input   IN  CLOB,
    p_output  OUT CLOB,
    p_success OUT NUMBER
  ) AS
    v_resp_id NUMBER;
    v_clob CLOB;
    v_resp_encontrada BOOLEAN := FALSE;
    v_primero BOOLEAN := TRUE;
    v_primer_op BOOLEAN := TRUE;
  BEGIN
    p_success := 1;
    v_resp_id := JSON_VALUE(p_input, '$.id_cuestionario_respuesta' RETURNING NUMBER);

    IF v_resp_id IS NULL THEN
      p_success := 0;
      p_output := '{"success":false,"error":"Parámetro id_cuestionario_respuesta es requerido"}';
      RETURN;
    END IF;

    DBMS_LOB.CREATETEMPORARY(v_clob, TRUE);

    -- Load Questionnaire Response Meta
    FOR rec IN (
      SELECT cr.id, cr.id_cuestionario, c.nombre as cuestionario_nombre, cr.id_usuario, 
             c.id_tipo_cuestionario,
             TO_CHAR(cr.fecha_inicio, 'YYYY-MM-DD"T"HH24:MI:SS') as fecha_inicio,
             TO_CHAR(cr.fecha_fin, 'YYYY-MM-DD"T"HH24:MI:SS') as fecha_fin,
             cr.puntaje_total, cr.clasificacion_final, cr.estado
      FROM tkr_cuestionario_respuesta cr, tkr_cuestionarios c
      WHERE cr.id = v_resp_id AND cr.id_cuestionario = c.id
    ) LOOP
      v_resp_encontrada := TRUE;
      DBMS_LOB.APPEND(v_clob, '{"success":true,"data":{' ||
        '"id":' || rec.id ||
        ',"id_cuestionario":' || rec.id_cuestionario ||
        ',"cuestionario_nombre":"' || f_escape_json(rec.cuestionario_nombre) || '"' ||
        ',"id_usuario":' || NVL(TO_CHAR(rec.id_usuario), 'null') ||
        ',"id_tipo_cuestionario":' || NVL(rec.id_tipo_cuestionario, 1) ||
        ',"fecha_inicio":"' || rec.fecha_inicio || '"' ||
        ',"fecha_fin":' || CASE WHEN rec.fecha_fin IS NOT NULL THEN '"' || rec.fecha_fin || '"' ELSE 'null' END ||
        ',"puntaje_total":' || NVL(rec.puntaje_total, 0) ||
        ',"clasificacion_final":' || CASE WHEN rec.clasificacion_final IS NOT NULL THEN '"' || f_escape_json(rec.clasificacion_final) || '"' ELSE 'null' END ||
        ',"estado":' || rec.estado ||
        ',"respuestas":[');

      -- Fetch individual question responses
      FOR a IN (
        SELECT ans.id, ans.id_pregunta, p.codigo as pregunta_codigo, p.texto_pregunta, 
               ans.respuesta_texto, ans.respuesta_numero, TO_CHAR(ans.respuesta_fecha, 'YYYY-MM-DD') as respuesta_fecha, 
               ans.valor_obtenido
        FROM tkr_respuestas ans, tkr_preguntas p
        WHERE ans.id_cuestionario_respuesta = rec.id AND ans.id_pregunta = p.id AND ans.estado = 1
        ORDER BY p.orden_visual
      ) LOOP
        IF NOT v_primero THEN
          DBMS_LOB.APPEND(v_clob, ',');
        END IF;
        v_primero := FALSE;

        DBMS_LOB.APPEND(v_clob, '{"id":' || a.id ||
          ',"id_pregunta":' || a.id_pregunta ||
          ',"pregunta_codigo":"' || a.pregunta_codigo || '"' ||
          ',"pregunta_texto":"' || f_escape_json(f_clob_to_str(a.texto_pregunta)) || '"' ||
          ',"respuesta_texto":"' || f_escape_json(f_clob_to_str(a.respuesta_texto)) || '"' ||
          ',"respuesta_numero":' || NVL(TO_CHAR(a.respuesta_numero), 'null') ||
          ',"respuesta_fecha":' || CASE WHEN a.respuesta_fecha IS NOT NULL THEN '"' || a.respuesta_fecha || '"' ELSE 'null' END ||
          ',"valor_obtenido":' || a.valor_obtenido ||
          ',"opciones_seleccionadas":[');

        v_primer_op := TRUE;
        -- Fetch selected options
        FOR o IN (
          SELECT ro.id, ro.id_opcion_pregunta, op.texto_opcion, op.codigo_opcion, ro.valor_obtenido
          FROM tkr_respuesta_opciones ro, tkr_opciones_pregunta op
          WHERE ro.id_respuesta = a.id AND ro.id_opcion_pregunta = op.id AND ro.estado = 1
        ) LOOP
          IF NOT v_primer_op THEN
            DBMS_LOB.APPEND(v_clob, ',');
          END IF;
          v_primer_op := FALSE;

          DBMS_LOB.APPEND(v_clob, '{"id":' || o.id ||
            ',"id_opcion":' || o.id_opcion_pregunta ||
            ',"texto_opcion":"' || f_escape_json(o.texto_opcion) || '"' ||
            ',"codigo_opcion":"' || f_escape_json(o.codigo_opcion) || '"' ||
            ',"valor_obtenido":' || o.valor_obtenido || '}');
        END LOOP;
        
        DBMS_LOB.APPEND(v_clob, ']}');
      END LOOP;

      DBMS_LOB.APPEND(v_clob, ']');

      -- Load Clinical Results if SALUD_MENTAL
      IF rec.id_tipo_cuestionario = 2 THEN
        DBMS_LOB.APPEND(v_clob, ',"resultados_clinicos":[');
        DECLARE
          v_primer_res_clinico BOOLEAN := TRUE;
        BEGIN
          FOR v IN (
            SELECT id, codigo, nombre, descripcion
            FROM tkr_variables_calculadas
            WHERE id_cuestionario = rec.id_cuestionario AND estado = 1
            ORDER BY orden_visual
          ) LOOP
            DECLARE
              v_var_score NUMBER := 0;
              v_clasif VARCHAR2(500) := 'Sin Clasificar';
              v_color_vis VARCHAR2(30) := 'grey';
              v_r_desc VARCHAR2(1000) := '';
            BEGIN
              SELECT NVL(SUM(r.valor_obtenido * d.peso), 0)
              INTO v_var_score
              FROM tkr_respuestas r
              JOIN tkr_variables_calculadas_det d ON r.id_pregunta = d.id_pregunta
              WHERE r.id_cuestionario_respuesta = rec.id
                AND d.id_variable_calculada = v.id
                AND r.estado = 1 AND d.estado = 1;

              -- Find corresponding clinical range
              BEGIN
                SELECT clasificacion, descripcion, color_visual
                INTO v_clasif, v_r_desc, v_color_vis
                FROM tkr_rangos_interpretacion
                WHERE id_cuestionario = rec.id_cuestionario
                  AND id_variable_calculada = v.id
                  AND v_var_score BETWEEN valor_minimo AND valor_maximo
                  AND estado = 1
                  AND ROWNUM = 1;
              EXCEPTION
                WHEN NO_DATA_FOUND THEN
                  v_clasif := 'Completado';
                  v_r_desc := 'Puntaje de variable obtenido';
                  v_color_vis := 'green';
              END;

              IF NOT v_primer_res_clinico THEN
                DBMS_LOB.APPEND(v_clob, ',');
              END IF;
              v_primer_res_clinico := FALSE;

              DBMS_LOB.APPEND(v_clob, '{"codigo":"' || f_escape_json(v.codigo) || '"' ||
                ',"nombre":"' || f_escape_json(v.nombre) || '"' ||
                ',"score":' || v_var_score ||
                ',"clasificacion":"' || f_escape_json(v_clasif) || '"' ||
                ',"descripcion":"' || f_escape_json(v_r_desc) || '"' ||
                ',"color_visual":"' || f_escape_json(v_color_vis) || '"}');
            END;
          END LOOP;
        END;
        DBMS_LOB.APPEND(v_clob, ']');
      END IF;

      DBMS_LOB.APPEND(v_clob, '}}');
    END LOOP;

    IF NOT v_resp_encontrada THEN
      p_success := 0;
      p_output := '{"success":false,"error":"Detalle de respuesta no encontrado"}';
    ELSE
      p_output := v_clob;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      p_success := 0;
      p_output := '{"success":false,"error":"' || REPLACE(SQLERRM, '"', '\"') || '"}';
  END sp_obtener_respuesta_detalle;

  -- 10. Get admin dashboard stats
  PROCEDURE sp_obtener_dashboard_stats(
    p_input   IN  CLOB,
    p_output  OUT CLOB,
    p_success OUT NUMBER
  ) AS
    v_clob CLOB;
    v_cuest_count NUMBER;
    v_total_preg NUMBER;
    v_count_unica NUMBER;
    v_count_multiple NUMBER;
    v_count_abierta NUMBER;
    v_count_asociativa NUMBER;
    
    v_cuest_sm_count NUMBER;
    v_vars_count NUMBER;
    v_rangos_count NUMBER;

    -- Loop variables
    v_primero BOOLEAN := TRUE;
  BEGIN
    p_success := 1;
    DBMS_LOB.CREATETEMPORARY(v_clob, TRUE);

    -- 1. General Metrics
    SELECT COUNT(*) INTO v_cuest_count FROM tkr_cuestionarios WHERE estado = 1;

    SELECT COUNT(*) INTO v_total_preg
    FROM tkr_preguntas p
    JOIN tkr_cuestionarios c ON p.id_cuestionario = c.id
    WHERE p.estado = 1 AND c.estado = 1;

    SELECT COUNT(CASE WHEN p.id_tipo_pregunta = 1 THEN 1 END),
           COUNT(CASE WHEN p.id_tipo_pregunta = 2 THEN 1 END),
           COUNT(CASE WHEN p.id_tipo_pregunta = 3 THEN 1 END),
           COUNT(CASE WHEN p.id_tipo_pregunta = 4 THEN 1 END)
    INTO v_count_unica, v_count_multiple, v_count_abierta, v_count_asociativa
    FROM tkr_preguntas p
    JOIN tkr_cuestionarios c ON p.id_cuestionario = c.id
    WHERE p.estado = 1 AND c.estado = 1;
    
    -- Clinical Metrics
    SELECT COUNT(*) INTO v_cuest_sm_count FROM tkr_cuestionarios WHERE id_tipo_cuestionario = 2 AND estado = 1;
    SELECT COUNT(*) INTO v_vars_count FROM tkr_variables_calculadas WHERE estado = 1;
    SELECT COUNT(*) INTO v_rangos_count FROM tkr_rangos_interpretacion WHERE estado = 1;

    DBMS_LOB.APPEND(v_clob, '{"success":true,"metrics":{' ||
      '"total_cuestionarios":' || v_cuest_count ||
      ',"total_preguntas":' || v_total_preg ||
      ',"count_unica":' || v_count_unica ||
      ',"count_multiple":' || v_count_multiple ||
      ',"count_abierta":' || v_count_abierta ||
      ',"count_asociativa":' || v_count_asociativa ||
      ',"total_cuestionarios_sm":' || v_cuest_sm_count ||
      ',"total_variables_calculadas":' || v_vars_count ||
      ',"total_rangos_configurados":' || v_rangos_count ||
      '},"cuestionarios_desglose":[');

    -- 2. Breakdown per questionnaire
    FOR c IN (
      SELECT id, nombre, version, publicado, id_tipo_cuestionario
      FROM tkr_cuestionarios
      WHERE estado = 1
      ORDER BY nombre
    ) LOOP
      DECLARE
        v_c_preg_count NUMBER;
      BEGIN
        -- Count active questions
        SELECT COUNT(*) INTO v_c_preg_count
        FROM tkr_preguntas
        WHERE id_cuestionario = c.id AND estado = 1;

        IF NOT v_primero THEN
          DBMS_LOB.APPEND(v_clob, ',');
        END IF;
        v_primero := FALSE;

        DBMS_LOB.APPEND(v_clob, '{"id":' || c.id ||
          ',"nombre":"' || f_escape_json(c.nombre) || '"' ||
          ',"version":' || c.version ||
          ',"publicado":' || c.publicado ||
          ',"id_tipo_cuestionario":' || NVL(c.id_tipo_cuestionario, 1) ||
          ',"total_preguntas":' || v_c_preg_count || '}');
      END;
    END LOOP;

    DBMS_LOB.APPEND(v_clob, '],"distribucion_clasificaciones":[');
    
    -- 3. Distribution of clinical classifications
    DECLARE
      v_primer_dist BOOLEAN := TRUE;
    BEGIN
      FOR d IN (
        SELECT cr.clasificacion_final, COUNT(*) as cantidad
        FROM tkr_cuestionario_respuesta cr
        JOIN tkr_cuestionarios c ON cr.id_cuestionario = c.id
        WHERE c.id_tipo_cuestionario = 2 AND cr.estado = 1 AND cr.clasificacion_final IS NOT NULL
        GROUP BY cr.clasificacion_final
        ORDER BY cantidad DESC
      ) LOOP
        IF NOT v_primer_dist THEN
          DBMS_LOB.APPEND(v_clob, ',');
        END IF;
        v_primer_dist := FALSE;
        DBMS_LOB.APPEND(v_clob, '{"clasificacion":"' || f_escape_json(d.clasificacion_final) || '","cantidad":' || d.cantidad || '}');
      END LOOP;
    END;

    DBMS_LOB.APPEND(v_clob, '],"distribucion_niveles_riesgo":[');
    
    -- 4. Distribution of clinical risk levels
    DECLARE
      v_primer_riesgo BOOLEAN := TRUE;
    BEGIN
      FOR d IN (
        SELECT ri.nombre_rango, COUNT(*) as cantidad
        FROM tkr_cuestionario_respuesta cr
        JOIN tkr_cuestionarios c ON cr.id_cuestionario = c.id
        JOIN tkr_rangos_interpretacion ri ON ri.id_cuestionario = c.id
          AND cr.puntaje_total BETWEEN ri.valor_minimo AND ri.valor_maximo
        WHERE c.id_tipo_cuestionario = 2 AND cr.estado = 1 AND ri.estado = 1
        GROUP BY ri.nombre_rango
        ORDER BY cantidad DESC
      ) LOOP
        IF NOT v_primer_riesgo THEN
          DBMS_LOB.APPEND(v_clob, ',');
        END IF;
        v_primer_riesgo := FALSE;
        DBMS_LOB.APPEND(v_clob, '{"rango":"' || f_escape_json(d.nombre_rango) || '","cantidad":' || d.cantidad || '}');
      END LOOP;
    END;

    DBMS_LOB.APPEND(v_clob, ']}');
    p_output := v_clob;
  EXCEPTION
    WHEN OTHERS THEN
      p_success := 0;
      p_output := '{"success":false,"error":"' || REPLACE(SQLERRM, '"', '\"') || '"}';
  END sp_obtener_dashboard_stats;

END pkgln_cuestionarios;
/
