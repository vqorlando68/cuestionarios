import oracledb from 'oracledb';

const dbConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectString: process.env.DB_CONNECTION_STRING
};

// Set outFormat globally to object
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

// Helper to acquire a database connection with auto-retries for transient network drops (like ECONNRESET / NJS-500)
export async function getConnectionWithRetry(retries = 3, delay = 500) {
    for (let i = 0; i < retries; i++) {
        try {
            return await oracledb.getConnection(dbConfig);
        } catch (err) {
            const errMsg = err.message || '';
            const errCode = err.code || '';
            const isTransient = errCode === 'NJS-500' || errCode === 'NJS-501' || errMsg.includes('ECONNRESET') || errMsg.includes('closed or broken');
            
            if (isTransient && i < retries - 1) {
                console.warn(`Database connection dropped (attempt ${i + 1}/${retries}). Retrying in ${delay}ms...`, errMsg);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                throw err;
            }
        }
    }
}

export async function callOracleProcedure(procName, inputParams = {}) {
    let connection;
    try {
        connection = await getConnectionWithRetry();
        const result = await connection.execute(
            `BEGIN ${procName}(:p_input, :p_output, :p_success); END;`,
            {
                p_input: { val: JSON.stringify(inputParams), type: oracledb.STRING, dir: oracledb.BIND_IN },
                p_output: { type: oracledb.CLOB, dir: oracledb.BIND_OUT },
                p_success: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT }
            },
            { autoCommit: true }
        );

        if (result.outBinds.p_success === 1) {
            const lob = result.outBinds.p_output;
            if (lob) {
                const clobData = await lob.getData();
                return JSON.parse(clobData);
            }
            return { success: true, data: null };
        } else {
            const lob = result.outBinds.p_output;
            const errorData = lob ? await lob.getData() : '{"error": "Unknown Oracle Error"}';
            throw new Error(errorData);
        }
    } catch (err) {
        console.error(`Error in ${procName}:`, err);
        throw err;
    } finally {
        if (connection) {
            try { await connection.close(); } catch (e) { console.error(e); }
        }
    }
}

export async function callOracleFunction(funcName) {
    let connection;
    try {
        connection = await getConnectionWithRetry();
        const result = await connection.execute(
            `SELECT ${funcName} FROM DUAL`
        );
        const data = result.rows[0][0];
        // If it's a CLOB, we need to read it
        if (data && typeof data.getData === 'function') {
            const clobData = await data.getData();
            return JSON.parse(clobData);
        }
        return typeof data === 'string' ? JSON.parse(data) : data;
    } catch (err) {
        console.error(`Error calling function ${funcName}:`, err);
        throw err;
    } finally {
        if (connection) {
            try { await connection.close(); } catch (e) { console.error(e); }
        }
    }
}

export async function executeSql(sql, binds = {}, options = { outFormat: oracledb.OUT_FORMAT_OBJECT, autoCommit: true }) {
    let connection;
    try {
        connection = await getConnectionWithRetry();
        const result = await connection.execute(sql, binds, options);
        return result;
    } catch (err) {
        console.error(`Error executing SQL: ${sql}`, err);
        throw err;
    } finally {
        if (connection) {
            try { await connection.close(); } catch (e) { console.error(e); }
        }
    }
}
