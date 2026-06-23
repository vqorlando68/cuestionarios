import { NextResponse } from 'next/server';
import { callOracleProcedure } from '@/lib/db';

export async function POST(request) {
    try {
        const { id_cuestionario_respuesta } = await request.json();
        
        if (!id_cuestionario_respuesta) {
            return NextResponse.json({ success: false, error: 'Parámetro id_cuestionario_respuesta es requerido' }, { status: 400 });
        }

        const data = await callOracleProcedure('pkgln_cuestionarios.sp_finalizar_cuestionario', { 
            id_cuestionario_respuesta: parseInt(id_cuestionario_respuesta)
        });
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error finalizing response:', error);
        return NextResponse.json({ success: false, error: error.message || 'Database error' }, { status: 500 });
    }
}

