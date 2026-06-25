import { NextResponse } from 'next/server';
import { executeSql } from '@/lib/db';

export async function POST(request) {
    try {
        const { id_cuestionario_respuesta, entrada_clob } = await request.json();
        
        if (!id_cuestionario_respuesta) {
            return NextResponse.json({ success: false, error: 'Parámetro id_cuestionario_respuesta es requerido' }, { status: 400 });
        }

        // Convert to string if it is passed as an object
        const clobValue = typeof entrada_clob === 'string' ? entrada_clob : JSON.stringify(entrada_clob, null, 2);

        await executeSql(
            `UPDATE tkr_cuestionario_respuesta 
             SET entrada_clob = :entrada_clob 
             WHERE id = :id_cuestionario_respuesta`,
            {
                entrada_clob: clobValue,
                id_cuestionario_respuesta: parseInt(id_cuestionario_respuesta)
            }
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error saving CLOB result JSON:', error);
        return NextResponse.json({ success: false, error: error.message || 'Database error' }, { status: 500 });
    }
}
