--------------------------------------------------------------------------------
-- SCRIPT DE MIGRACIÓN: ACTUALIZACIÓN DE TABLAS CLÍNICAS (SEPARADOS POR '/')
--------------------------------------------------------------------------------

-- Eliminar tablas y secuencias previas si existen
BEGIN
    EXECUTE IMMEDIATE 'DROP TABLE tkr_variables_calculadas_det CASCADE CONSTRAINTS';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

BEGIN
    EXECUTE IMMEDIATE 'DROP TABLE tkr_variables_calculadas CASCADE CONSTRAINTS';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

BEGIN
    EXECUTE IMMEDIATE 'DROP SEQUENCE tkr_vars_calc_seq';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

BEGIN
    EXECUTE IMMEDIATE 'DROP SEQUENCE tkr_vars_calc_det_seq';
EXCEPTION WHEN OTHERS THEN NULL;
END;
/

--------------------------------------------------------------------------------
-- TABLA: TKR_VARIABLES_CALCULADAS
--------------------------------------------------------------------------------
CREATE TABLE tkr_variables_calculadas
(
    id                 NUMBER NOT NULL,
    id_cuestionario    NUMBER NOT NULL,
    codigo             VARCHAR2(100) NOT NULL,
    nombre             VARCHAR2(200) NOT NULL,
    descripcion        VARCHAR2(1000),
    formula_calculo    VARCHAR2(1000),
    valor_minimo       NUMBER,
    valor_maximo       NUMBER,
    unidad_medida      VARCHAR2(100),
    orden_visual       NUMBER DEFAULT 1 NOT NULL,
    estado             NUMBER(1) DEFAULT 1 NOT NULL,
    fecha_creacion     DATE DEFAULT SYSDATE NOT NULL,
    
    CONSTRAINT pk_tkr_variables_calculadas PRIMARY KEY (id),
    CONSTRAINT fk_tkr_vars_calc_cuest FOREIGN KEY (id_cuestionario) REFERENCES tkr_cuestionarios (id),
    CONSTRAINT ck_tkr_vars_calc_estado CHECK (estado IN (0, 1))
)
/

CREATE SEQUENCE tkr_vars_calc_seq START WITH 1 INCREMENT BY 1 NOCACHE
/

CREATE OR REPLACE TRIGGER trg_bi_tkr_variables_calculadas
    BEFORE INSERT
    ON tkr_variables_calculadas
    FOR EACH ROW
BEGIN
    IF :NEW.id IS NULL THEN
        :NEW.id := tkr_vars_calc_seq.NEXTVAL;
    END IF;
END;
/

--------------------------------------------------------------------------------
-- TABLA: TKR_VARIABLES_CALCULADAS_DET
--------------------------------------------------------------------------------
CREATE TABLE tkr_variables_calculadas_det
(
    id                     NUMBER NOT NULL,
    id_variable_calculada  NUMBER NOT NULL,
    id_pregunta            NUMBER NOT NULL,
    peso                   NUMBER DEFAULT 1 NOT NULL,
    orden_visual           NUMBER DEFAULT 1 NOT NULL,
    estado                 NUMBER(1) DEFAULT 1 NOT NULL,
    
    CONSTRAINT pk_tkr_vars_calc_det PRIMARY KEY (id),
    CONSTRAINT fk_tkr_vc_det_variable FOREIGN KEY (id_variable_calculada) REFERENCES tkr_variables_calculadas (id) ON DELETE CASCADE,
    CONSTRAINT fk_tkr_vc_det_pregunta FOREIGN KEY (id_pregunta) REFERENCES tkr_preguntas (id),
    CONSTRAINT ck_tkr_vars_calc_det_est CHECK (estado IN (0, 1))
)
/

CREATE SEQUENCE tkr_vars_calc_det_seq START WITH 1 INCREMENT BY 1 NOCACHE
/

CREATE OR REPLACE TRIGGER trg_bi_tkr_vars_calc_det
    BEFORE INSERT
    ON tkr_variables_calculadas_det
    FOR EACH ROW
BEGIN
    IF :NEW.id IS NULL THEN
        :NEW.id := tkr_vars_calc_det_seq.NEXTVAL;
    END IF;
END;
/

--------------------------------------------------------------------------------
-- POBLAR SEMILLA DE TIPOS DE CUESTIONARIO
--------------------------------------------------------------------------------
MERGE INTO tkr_tipos_cuestionario target
USING (
    SELECT 1 AS id, 'GENERAL' AS codigo, 'General' AS nombre, 'Cuestionarios estándar sin lógica clínica' AS descripcion FROM dual UNION ALL
    SELECT 2 AS id, 'SALUD_MENTAL' AS codigo, 'Salud Mental' AS nombre, 'Evaluaciones clínicas psicológicas y psiquiátricas' AS descripcion FROM dual UNION ALL
    SELECT 3 AS id, 'MEDICINA' AS codigo, 'Medicina' AS nombre, 'Cuestionarios de salud general y medicina física' AS descripcion FROM dual UNION ALL
    SELECT 4 AS id, 'RIESGO' AS codigo, 'Riesgo' AS nombre, 'Evaluación de riesgos institucionales y laborales' AS descripcion FROM dual
) source
ON (target.id = source.id)
WHEN MATCHED THEN
    UPDATE SET target.codigo = source.codigo, target.nombre = source.nombre, target.descripcion = source.descripcion
WHEN NOT MATCHED THEN
    INSERT (id, codigo, nombre, descripcion, estado)
    VALUES (source.id, source.codigo, source.nombre, source.descripcion, 1)
/

COMMIT
/
