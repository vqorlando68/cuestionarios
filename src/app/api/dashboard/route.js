import { NextResponse } from 'next/server';
import { callOracleProcedure } from '@/lib/db';

export async function GET() {
    try {
        const data = await callOracleProcedure('pkgln_cuestionarios.sp_obtener_dashboard_stats', {});
        return NextResponse.json({ 
            success: true, 
            metrics: data.metrics,
            cuestionarios_desglose: data.cuestionarios_desglose 
        });
    } catch (error) {
        console.error('Error fetching dashboard statistics:', error);
        return NextResponse.json({ success: false, error: error.message || 'Database error' }, { status: 500 });
    }
}
