import { NextResponse } from 'next/server';
import { callOracleProcedure } from '@/lib/db';

export async function POST(request) {
    try {
        const { id_cuestionario, id_usuario } = await request.json();
        if (!id_cuestionario) {
            return NextResponse.json({ success: false, error: 'Parámetro id_cuestionario es requerido' }, { status: 400 });
        }
        const data = await callOracleProcedure('pkgln_cuestionarios.sp_iniciar_respuesta', { 
            id_cuestionario: parseInt(id_cuestionario), 
            id_usuario: id_usuario ? parseInt(id_usuario) : null 
        });
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error starting questionnaire response:', error);
        return NextResponse.json({ success: false, error: error.message || 'Database error' }, { status: 500 });
    }
}

