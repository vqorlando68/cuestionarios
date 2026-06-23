import { NextResponse } from 'next/server';
import { callOracleProcedure } from '@/lib/db';

export async function POST(request) {
    try {
        const { id, nuevo_nombre } = await request.json();
        if (!id) {
            return NextResponse.json({ success: false, error: 'Parámetro id es requerido' }, { status: 400 });
        }
        const data = await callOracleProcedure('pkgln_cuestionarios.sp_duplicar_cuestionario', { id: parseInt(id), nuevo_nombre });
        return NextResponse.json({ success: true, id: data.id });
    } catch (error) {
        console.error('Error duplicating questionnaire:', error);
        return NextResponse.json({ success: false, error: error.message || 'Database error' }, { status: 500 });
    }
}
