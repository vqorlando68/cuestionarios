import { NextResponse } from 'next/server';
import { callOracleProcedure } from '@/lib/db';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (id) {
            // Get detailed questionnaire
            const data = await callOracleProcedure('pkgln_cuestionarios.sp_obtener_cuestionario_detalle', { id: parseInt(id) });
            return NextResponse.json(data);
        } else {
            // Get list of questionnaires
            const data = await callOracleProcedure('pkgln_cuestionarios.sp_obtener_cuestionarios', {});
            return NextResponse.json(data);
        }
    } catch (error) {
        console.error('Error fetching questionnaires:', error);
        return NextResponse.json({ success: false, error: error.message || 'Database error' }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const questionnaireData = await request.json();
        const data = await callOracleProcedure('pkgln_cuestionarios.sp_guardar_cuestionario', questionnaireData);
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error saving questionnaire:', error);
        let errorMsg = error.message || 'Database error';
        if (errorMsg.includes('FK_TKR_VC_DET_PREGUNTA') || errorMsg.includes('ORA-02291')) {
            errorMsg = 'Error de integridad: Una dimensión o variable clínica hace referencia a una pregunta que fue eliminada o no existe en el cuestionario. Por favor, revise la configuración de variables clínicas.';
        }
        return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
    }
}

export async function PUT(request) {
    try {
        const { id, accion } = await request.json();
        const data = await callOracleProcedure('pkgln_cuestionarios.sp_cambiar_estado_cuestionario', { id: parseInt(id), accion });
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error changing questionnaire status:', error);
        return NextResponse.json({ success: false, error: error.message || 'Database error' }, { status: 500 });
    }
}

