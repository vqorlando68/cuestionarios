import { NextResponse } from 'next/server';
import { callOracleProcedure } from '@/lib/db';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ success: false, error: 'Parámetro id es requerido' }, { status: 400 });
        }

        const data = await callOracleProcedure('pkgln_cuestionarios.sp_obtener_respuesta_detalle', { 
            id_cuestionario_respuesta: parseInt(id) 
        });
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error fetching response detail:', error);
        return NextResponse.json({ success: false, error: error.message || 'Database error' }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const { id_cuestionario_respuesta, respuestas } = await request.json();
        
        if (!id_cuestionario_respuesta) {
            return NextResponse.json({ success: false, error: 'Parámetro id_cuestionario_respuesta es requerido' }, { status: 400 });
        }

        const data = await callOracleProcedure('pkgln_cuestionarios.sp_guardar_respuestas', { 
            id_cuestionario_respuesta: parseInt(id_cuestionario_respuesta),
            respuestas
        });
        return NextResponse.json(data);
    } catch (error) {
        console.error('Error saving responses:', error);
        return NextResponse.json({ success: false, error: error.message || 'Database error' }, { status: 500 });
    }
}

