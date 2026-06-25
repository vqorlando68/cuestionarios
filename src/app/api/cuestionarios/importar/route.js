import { NextResponse } from 'next/server';
import { callOracleProcedure, executeSql } from '@/lib/db';

export async function POST(request) {
    try {
        const { cuestionario, usarMismoId } = await request.json();

        if (!cuestionario || !cuestionario.nombre) {
            return NextResponse.json({ success: false, error: 'Configuración de cuestionario inválida' }, { status: 400 });
        }

        let finalCuestionarioId = null;

        if (usarMismoId && cuestionario.id) {
            const cuestionarioId = parseInt(cuestionario.id);
            
            // Check if questionnaire exists in database
            const checkSql = `SELECT COUNT(*) AS CNT FROM tkr_cuestionarios WHERE id = :id`;
            const checkResult = await executeSql(checkSql, { id: cuestionarioId });
            const exists = checkResult.rows && checkResult.rows[0] && 
                           (checkResult.rows[0].CNT > 0 || checkResult.rows[0].cnt > 0 || checkResult.rows[0].Cnty > 0);

            if (exists) {
                // Execute cascade delete
                const deleteSql = `
                    DECLARE
                      v_id NUMBER := :id;
                    BEGIN
                      -- Delete response options
                      DELETE FROM tkr_respuesta_opciones WHERE id_respuesta IN (
                        SELECT r.id FROM tkr_respuestas r
                        JOIN tkr_cuestionario_respuesta cr ON r.id_cuestionario_respuesta = cr.id
                        WHERE cr.id_cuestionario = v_id
                      );
                      
                      -- Delete responses
                      DELETE FROM tkr_respuestas WHERE id_cuestionario_respuesta IN (
                        SELECT id FROM tkr_cuestionario_respuesta WHERE id_cuestionario = v_id
                      );
                      
                      -- Delete questionnaire responses
                      DELETE FROM tkr_cuestionario_respuesta WHERE id_cuestionario = v_id;
                      
                      -- Delete rangos clinicos / interpretacion
                      DELETE FROM tkr_rangos_interpretacion WHERE id_cuestionario = v_id;
                      
                      -- Delete general results
                      DELETE FROM tkr_resultados_cuestionario WHERE id_cuestionario = v_id;
                      
                      -- Delete clinical variables details
                      DELETE FROM tkr_variables_calculadas_det WHERE id_variable_calculada IN (
                        SELECT id FROM tkr_variables_calculadas WHERE id_cuestionario = v_id
                      );
                      
                      -- Delete clinical variables
                      DELETE FROM tkr_variables_calculadas WHERE id_cuestionario = v_id;
                      
                      -- Delete flow rules
                      DELETE FROM tkr_reglas_flujo WHERE id_flujo_pregunta IN (
                        SELECT fp.id FROM tkr_flujos_pregunta fp
                        JOIN tkr_preguntas p ON fp.id_pregunta_origen = p.id
                        WHERE p.id_cuestionario = v_id
                      );
                      
                      -- Delete flows
                      DELETE FROM tkr_flujos_pregunta WHERE id_pregunta_origen IN (
                        SELECT id FROM tkr_preguntas WHERE id_cuestionario = v_id
                      );
                      
                      -- Delete associations
                      DELETE FROM tkr_pregunta_asociativa WHERE id_pregunta IN (
                        SELECT id FROM tkr_preguntas WHERE id_cuestionario = v_id
                      );
                      
                      -- Delete options
                      DELETE FROM tkr_opciones_pregunta WHERE id_pregunta IN (
                        SELECT id FROM tkr_preguntas WHERE id_cuestionario = v_id
                      );
                      
                      -- Delete questions
                      DELETE FROM tkr_preguntas WHERE id_cuestionario = v_id;
                      
                      -- Delete sections
                      DELETE FROM tkr_secciones_cuestionario WHERE id_cuestionario = v_id;
                      
                      -- Delete questionnaire cabecera
                      DELETE FROM tkr_cuestionarios WHERE id = v_id;
                      
                      COMMIT;
                    END;
                `;
                await executeSql(deleteSql, { id: cuestionarioId });
            }

            // Insert skeleton row in tkr_cuestionarios using this exact ID
            const insertSql = `
                INSERT INTO tkr_cuestionarios (
                  id, nombre, descripcion, version, publicado, id_tipo_cuestionario, presentacion_unica, fecha_creacion, estado
                ) VALUES (
                  :id, :nombre, :descripcion, :version, :publicado, :id_tipo_cuestionario, :presentacion_unica, SYSDATE, 1
                )
            `;
            const insertBinds = {
                id: cuestionarioId,
                nombre: cuestionario.nombre,
                descripcion: cuestionario.descripcion || '',
                version: cuestionario.version || 1,
                publicado: cuestionario.publicado || 0,
                id_tipo_cuestionario: cuestionario.id_tipo_cuestionario || 1,
                presentacion_unica: cuestionario.presentacion_unica || 0
            };
            await executeSql(insertSql, insertBinds);

            finalCuestionarioId = cuestionarioId;
        } else {
            // New ID - remove/set to null the ID in the JSON
            cuestionario.id = null;
        }

        // Call the save procedure to parse the full config (sections, questions, rules, etc.)
        const saveResult = await callOracleProcedure('pkgln_cuestionarios.sp_guardar_cuestionario', cuestionario);

        if (saveResult && saveResult.success) {
            return NextResponse.json({ 
                success: true, 
                id: saveResult.id || finalCuestionarioId, 
                version: saveResult.version 
            });
        } else {
            return NextResponse.json({ 
                success: false, 
                error: (saveResult && saveResult.error) || 'Error desconocido al guardar el cuestionario' 
            }, { status: 500 });
        }
    } catch (error) {
        console.error('Error importing questionnaire:', error);
        let errorMsg = error.message || 'Error en la base de datos';
        if (errorMsg.includes('FK_TKR_VC_DET_PREGUNTA') || errorMsg.includes('ORA-02291')) {
            errorMsg = 'Error de integridad: Una dimensión o variable clínica hace referencia a una pregunta que fue eliminada o no existe en el cuestionario. Por favor, revise la configuración de variables clínicas.';
        }
        return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
    }
}
