
/*****************************************************************************************
 SISTEMA DE CUESTIONARIOS DINÁMICOS
 Autor: ChatGPT
 Base de datos: Oracle
 Convenciones:
 - Todas las tablas inician con tkr_
 - PK: id NUMBER
 - Secuencia: <tabla>_seq
 - Trigger BEFORE INSERT para PK
 - Estado: 0=Inactivo, 1=Activo
*****************************************************************************************/

/*==============================================================
 TABLA: tkr_tipos_pregunta
==============================================================*/
CREATE TABLE tkr_tipos_pregunta (
    id NUMBER PRIMARY KEY,
    codigo VARCHAR2(50) NOT NULL,
    nombre VARCHAR2(200) NOT NULL,
    descripcion VARCHAR2(1000),
    permite_opciones NUMBER(1),
    permite_valor NUMBER(1),
    estado NUMBER(1) DEFAULT 1
);

COMMENT ON TABLE tkr_tipos_pregunta IS 'Catálogo de tipos de pregunta';
COMMENT ON COLUMN tkr_tipos_pregunta.codigo IS 'Código único del tipo de pregunta';
COMMENT ON COLUMN tkr_tipos_pregunta.permite_opciones IS '1=usa opciones, 0=no';
COMMENT ON COLUMN tkr_tipos_pregunta.permite_valor IS '1=permite puntuación';

/*==============================================================
 TABLA: tkr_cuestionarios
==============================================================*/
CREATE TABLE tkr_cuestionarios (
    id NUMBER PRIMARY KEY,
    nombre VARCHAR2(500) NOT NULL,
    descripcion CLOB,
    version NUMBER,
    publicado NUMBER(1),
    fecha_creacion DATE,
    fecha_publicacion DATE,
    estado NUMBER(1)
);

COMMENT ON TABLE tkr_cuestionarios IS 'Definición principal del cuestionario';

/*==============================================================
 TABLA: tkr_secciones_cuestionario
==============================================================*/
CREATE TABLE tkr_secciones_cuestionario (
    id NUMBER PRIMARY KEY,
    id_cuestionario NUMBER NOT NULL,
    nombre VARCHAR2(300),
    descripcion VARCHAR2(1000),
    orden_visual NUMBER,
    estado NUMBER(1)
);

COMMENT ON TABLE tkr_secciones_cuestionario IS 'Secciones o páginas del cuestionario';

/*==============================================================
 TABLA: tkr_preguntas
==============================================================*/
CREATE TABLE tkr_preguntas (
    id NUMBER PRIMARY KEY,
    id_cuestionario NUMBER NOT NULL,
    id_seccion_cuestionario NUMBER,
    id_tipo_pregunta NUMBER NOT NULL,
    codigo VARCHAR2(100),
    texto_pregunta CLOB,
    orden_visual NUMBER,
    obligatoria NUMBER(1),
    valor_pregunta NUMBER,
    permite_otro NUMBER(1),
    estado NUMBER(1)
);

COMMENT ON TABLE tkr_preguntas IS 'Preguntas del cuestionario';
COMMENT ON COLUMN tkr_preguntas.valor_pregunta IS 'Valor base de la pregunta';

/*==============================================================
 TABLA: tkr_opciones_pregunta
==============================================================*/
CREATE TABLE tkr_opciones_pregunta (
    id NUMBER PRIMARY KEY,
    id_pregunta NUMBER NOT NULL,
    texto_opcion VARCHAR2(4000),
    codigo_opcion VARCHAR2(100),
    orden_visual NUMBER,
    valor_opcion NUMBER,
    estado NUMBER(1)
);

COMMENT ON TABLE tkr_opciones_pregunta IS 'Opciones de respuesta';

/*==============================================================
 TABLA: tkr_pregunta_asociativa
==============================================================*/
CREATE TABLE tkr_pregunta_asociativa (
    id NUMBER PRIMARY KEY,
    id_pregunta NUMBER NOT NULL,
    item_izquierdo VARCHAR2(1000),
    item_derecho VARCHAR2(1000),
    valor_correcto NUMBER,
    estado NUMBER(1)
);

/*==============================================================
 TABLA: tkr_operadores
==============================================================*/
CREATE TABLE tkr_operadores (
    id NUMBER PRIMARY KEY,
    codigo VARCHAR2(50),
    descripcion VARCHAR2(500),
    estado NUMBER(1)
);

/*==============================================================
 TABLA: tkr_flujos_pregunta
==============================================================*/
CREATE TABLE tkr_flujos_pregunta (
    id NUMBER PRIMARY KEY,
    id_pregunta_origen NUMBER NOT NULL,
    id_opcion_respuesta NUMBER,
    id_operador NUMBER,
    valor_comparacion VARCHAR2(4000),
    id_pregunta_destino NUMBER NOT NULL,
    prioridad NUMBER,
    estado NUMBER(1)
);

COMMENT ON TABLE tkr_flujos_pregunta IS 'Navegación condicional entre preguntas';

/*==============================================================
 TABLA: tkr_reglas_flujo
==============================================================*/
CREATE TABLE tkr_reglas_flujo (
    id NUMBER PRIMARY KEY,
    id_flujo_pregunta NUMBER NOT NULL,
    campo_evaluado VARCHAR2(100),
    operador VARCHAR2(30),
    valor_esperado VARCHAR2(4000),
    agrupador VARCHAR2(10),
    estado NUMBER(1)
);

/*==============================================================
 TABLA: tkr_variables_calculadas
==============================================================*/
CREATE TABLE tkr_variables_calculadas (
    id NUMBER PRIMARY KEY,
    id_cuestionario NUMBER NOT NULL,
    codigo_variable VARCHAR2(100),
    nombre_variable VARCHAR2(500),
    tipo_variable VARCHAR2(50),
    formula CLOB,
    orden_calculo NUMBER,
    descripcion VARCHAR2(1000),
    estado NUMBER(1),
    fecha_creacion DATE
);

COMMENT ON TABLE tkr_variables_calculadas IS 'Variables derivadas y puntajes';

/*==============================================================
 TABLA: tkr_variables_calculadas_det
==============================================================*/
CREATE TABLE tkr_variables_calculadas_det (
    id NUMBER PRIMARY KEY,
    id_variable_calculada NUMBER NOT NULL,
    tipo_origen VARCHAR2(50),
    id_pregunta NUMBER,
    codigo_variable_origen VARCHAR2(100),
    operador VARCHAR2(20),
    secuencia NUMBER,
    estado NUMBER(1)
);

/*==============================================================
 TABLAS DE RESPUESTAS
==============================================================*/
CREATE TABLE tkr_cuestionario_respuesta (
    id NUMBER PRIMARY KEY,
    id_cuestionario NUMBER,
    id_usuario NUMBER,
    fecha_inicio DATE,
    fecha_fin DATE,
    puntaje_total NUMBER,
    clasificacion_final VARCHAR2(500),
    estado NUMBER(1),
    entrada_clob CLOB
);


CREATE TABLE tkr_respuestas (
    id NUMBER PRIMARY KEY,
    id_cuestionario_respuesta NUMBER,
    id_pregunta NUMBER,
    respuesta_texto CLOB,
    respuesta_numero NUMBER,
    respuesta_fecha DATE,
    valor_obtenido NUMBER,
    estado NUMBER(1)
);

CREATE TABLE tkr_respuesta_opciones (
    id NUMBER PRIMARY KEY,
    id_respuesta NUMBER,
    id_opcion_pregunta NUMBER,
    valor_obtenido NUMBER,
    estado NUMBER(1)
);

CREATE TABLE tkr_resultados_cuestionario (
    id NUMBER PRIMARY KEY,
    id_cuestionario NUMBER,
    puntaje_desde NUMBER,
    puntaje_hasta NUMBER,
    nombre_resultado VARCHAR2(500),
    descripcion CLOB,
    color VARCHAR2(30),
    estado NUMBER(1)
);

ALTER TABLE tkr_secciones_cuestionario ADD CONSTRAINT fk_sec_cuest FOREIGN KEY(id_cuestionario) REFERENCES tkr_cuestionarios(id);
ALTER TABLE tkr_preguntas ADD CONSTRAINT fk_preg_cuest FOREIGN KEY(id_cuestionario) REFERENCES tkr_cuestionarios(id);
ALTER TABLE tkr_preguntas ADD CONSTRAINT fk_preg_sec FOREIGN KEY(id_seccion_cuestionario) REFERENCES tkr_secciones_cuestionario(id);
ALTER TABLE tkr_preguntas ADD CONSTRAINT fk_preg_tipo FOREIGN KEY(id_tipo_pregunta) REFERENCES tkr_tipos_pregunta(id);
ALTER TABLE tkr_opciones_pregunta ADD CONSTRAINT fk_op_preg FOREIGN KEY(id_pregunta) REFERENCES tkr_preguntas(id);

CREATE SEQUENCE tkr_tipos_pregunta_seq START WITH 1;
CREATE SEQUENCE tkr_cuestionarios_seq START WITH 1;
CREATE SEQUENCE tkr_secciones_cuestionario_seq START WITH 1;
CREATE SEQUENCE tkr_preguntas_seq START WITH 1;
CREATE SEQUENCE tkr_opciones_pregunta_seq START WITH 1;
CREATE SEQUENCE tkr_cuest_resp_seq START WITH 1;
CREATE SEQUENCE tkr_respuestas_seq START WITH 1;
CREATE SEQUENCE tkr_resp_opciones_seq START WITH 1;
CREATE SEQUENCE tkr_preg_assoc_seq START WITH 1;
CREATE SEQUENCE tkr_flujos_preg_seq START WITH 1;
CREATE SEQUENCE tkr_reglas_flujo_seq START WITH 1;
CREATE SEQUENCE tkr_vars_calc_seq START WITH 1;
CREATE SEQUENCE tkr_res_cuest_seq START WITH 1;

CREATE OR REPLACE TRIGGER trg_tkr_tipos_pregunta_bi BEFORE INSERT ON tkr_tipos_pregunta FOR EACH ROW BEGIN IF :NEW.id IS NULL THEN :NEW.id:=tkr_tipos_pregunta_seq.NEXTVAL; END IF; END;
/
CREATE OR REPLACE TRIGGER trg_tkr_cuestionarios_bi BEFORE INSERT ON tkr_cuestionarios FOR EACH ROW BEGIN IF :NEW.id IS NULL THEN :NEW.id:=tkr_cuestionarios_seq.NEXTVAL; END IF; END;
/
CREATE OR REPLACE TRIGGER trg_tkr_secciones_cuestionario_bi BEFORE INSERT ON tkr_secciones_cuestionario FOR EACH ROW BEGIN IF :NEW.id IS NULL THEN :NEW.id:=tkr_secciones_cuestionario_seq.NEXTVAL; END IF; END;
/
CREATE OR REPLACE TRIGGER trg_tkr_preguntas_bi BEFORE INSERT ON tkr_preguntas FOR EACH ROW BEGIN IF :NEW.id IS NULL THEN :NEW.id:=tkr_preguntas_seq.NEXTVAL; END IF; END;
/
CREATE OR REPLACE TRIGGER trg_tkr_opciones_pregunta_bi BEFORE INSERT ON tkr_opciones_pregunta FOR EACH ROW BEGIN IF :NEW.id IS NULL THEN :NEW.id:=tkr_opciones_pregunta_seq.NEXTVAL; END IF; END;
/
CREATE OR REPLACE TRIGGER trg_tkr_cuest_resp_bi BEFORE INSERT ON tkr_cuestionario_respuesta FOR EACH ROW BEGIN IF :NEW.id IS NULL THEN :NEW.id:=tkr_cuest_resp_seq.NEXTVAL; END IF; END;
/
CREATE OR REPLACE TRIGGER trg_tkr_respuestas_bi BEFORE INSERT ON tkr_respuestas FOR EACH ROW BEGIN IF :NEW.id IS NULL THEN :NEW.id:=tkr_respuestas_seq.NEXTVAL; END IF; END;
/
CREATE OR REPLACE TRIGGER trg_tkr_resp_opciones_bi BEFORE INSERT ON tkr_respuesta_opciones FOR EACH ROW BEGIN IF :NEW.id IS NULL THEN :NEW.id:=tkr_resp_opciones_seq.NEXTVAL; END IF; END;
/
CREATE OR REPLACE TRIGGER trg_tkr_preg_assoc_bi BEFORE INSERT ON tkr_pregunta_asociativa FOR EACH ROW BEGIN IF :NEW.id IS NULL THEN :NEW.id:=tkr_preg_assoc_seq.NEXTVAL; END IF; END;
/
CREATE OR REPLACE TRIGGER trg_tkr_flujos_preg_bi BEFORE INSERT ON tkr_flujos_pregunta FOR EACH ROW BEGIN IF :NEW.id IS NULL THEN :NEW.id:=tkr_flujos_preg_seq.NEXTVAL; END IF; END;
/
CREATE OR REPLACE TRIGGER trg_tkr_reglas_flujo_bi BEFORE INSERT ON tkr_reglas_flujo FOR EACH ROW BEGIN IF :NEW.id IS NULL THEN :NEW.id:=tkr_reglas_flujo_seq.NEXTVAL; END IF; END;
/
CREATE OR REPLACE TRIGGER trg_tkr_vars_calc_bi BEFORE INSERT ON tkr_variables_calculadas FOR EACH ROW BEGIN IF :NEW.id IS NULL THEN :NEW.id:=tkr_vars_calc_seq.NEXTVAL; END IF; END;
/
CREATE OR REPLACE TRIGGER trg_tkr_res_cuest_bi BEFORE INSERT ON tkr_resultados_cuestionario FOR EACH ROW BEGIN IF :NEW.id IS NULL THEN :NEW.id:=tkr_res_cuest_seq.NEXTVAL; END IF; END;
/

INSERT INTO tkr_tipos_pregunta(codigo,nombre,permite_opciones,permite_valor,estado) VALUES ('UNICA','Selección única',1,1,1);
INSERT INTO tkr_tipos_pregunta(codigo,nombre,permite_opciones,permite_valor,estado) VALUES ('MULTIPLE','Selección múltiple',1,1,1);
INSERT INTO tkr_tipos_pregunta(codigo,nombre,permite_opciones,permite_valor,estado) VALUES ('ABIERTA', 'Texto abierto',0,0,1);
INSERT INTO tkr_tipos_pregunta(codigo,nombre,permite_opciones,permite_valor,estado) VALUES ('ASOCIATIVA','Asociativa',1,1,1);

COMMIT;
