/**
 * compile-package.cjs
 * Compiles pkgln_cuestionarios package (spec + body) to Oracle.
 * Usage: node compile-package.cjs
 */
const oracledb = require('oracledb');
const fs = require('fs');
const path = require('path');

// Manually load .env.local (Next.js handles it internally, dotenv is not installed)
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) return;
        const key = trimmed.substring(0, eqIdx).trim();
        // Remove surrounding quotes if present, then unescape \$ → $
        let val = trimmed.substring(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
        }
        val = val.replace(/\\(.)/g, '$1'); // unescape backslash sequences
        process.env[key] = val;
    });
}


async function compile() {
    let connection;
    try {
        console.log('Connecting to Oracle...');
        connection = await oracledb.getConnection({
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            connectionString: process.env.DB_CONNECTION_STRING,
        });
        console.log('Connected.\n');

        const files = [
            path.join(__dirname, 'database', 'pkgln_cuestionarios.pks'),
            path.join(__dirname, 'database', 'pkgln_cuestionarios.pkb'),
        ];

        for (const file of files) {
            let sql = fs.readFileSync(file, 'utf8').trim();
            if (sql.endsWith('/')) {
                sql = sql.slice(0, -1).trim();
            }
            const name = path.basename(file);
            console.log(`Compiling ${name}...`);
            try {
                await connection.execute(sql);
                console.log(`  ✓ ${name} compiled OK\n`);
            } catch (err) {
                console.error(`  ✗ Error compiling ${name}:`);
                console.error(`    ${err.message}\n`);
            }
        }

        // Check for errors
        console.log('Checking for compilation errors...');
        const result = await connection.execute(
            `SELECT type, name, line, position, text
             FROM user_errors
             WHERE name = 'PKGLN_CUESTIONARIOS'
             ORDER BY type, line`,
            [],
            { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );

        if (result.rows.length === 0) {
            console.log('✓ No compilation errors found.');
        } else {
            console.error(`✗ ${result.rows.length} compilation error(s):`);
            result.rows.forEach(r => {
                console.error(`  [${r.TYPE} line ${r.LINE}:${r.POSITION}] ${r.TEXT}`);
            });
        }
    } catch (err) {
        console.error('Fatal error:', err.message);
        process.exit(1);
    } finally {
        if (connection) {
            try { await connection.close(); } catch (e) { /* ignore */ }
        }
    }
}

compile();
