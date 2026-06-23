import { NextResponse } from 'next/server';
import oracledb from 'oracledb';
import { getConnectionWithRetry } from '@/lib/db';

export async function POST(request) {
    let connection;
    try {
        const { usuario, clave } = await request.json();
        console.log('Diagnostic incoming login request:', { usuario, clave });
        if (!usuario || !clave) {
            return NextResponse.json({ success: false, error: 'Usuario y clave son requeridos' }, { status: 400 });
        }

        connection = await getConnectionWithRetry();
        const result = await connection.execute(
            `SELECT pkgln_seguridad.f_validar_clave(:usuario, :clave, 12) FROM DUAL`,
            { usuario: usuario.trim(), clave: clave },
            { outFormat: oracledb.OUT_FORMAT_ARRAY }
        );

        const valor = result.rows[0][0];
        if (valor === 1) {
            // Success - return user info and mock role/session token
            return NextResponse.json({ 
                success: true, 
                usuario: usuario.trim(), 
                rol: 'Coordinador Médico', 
                token: 'mock-token-' + usuario.trim() + '-' + Date.now() 
            });
        } else {
            return NextResponse.json({ success: false, error: 'Usuario o clave incorrectos' }, { status: 401 });
        }
    } catch (error) {
        console.error('Error en login:', error);
        return NextResponse.json({ success: false, error: 'Error de conexión con el sistema' }, { status: 500 });
    } finally {
        if (connection) {
            try { await connection.close(); } catch (e) { console.error(e); }
        }
    }
}
