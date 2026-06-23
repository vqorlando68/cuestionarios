CREATE OR REPLACE PACKAGE pkgln_cuestionarios AS

  /*
        Nombre       : PKGLN_CUESTIONARIOS
        Descripción  : Paquete utilizado para los procesos correspondientes a
                       los cuestionarios dinámicos y sus respuestas.
        Autor        : Antigravity AI
        Fecha        : Junio 2026
  */

  -- List all questionnaires and summary statistics
  PROCEDURE sp_obtener_cuestionarios(
    p_input   IN  CLOB,
    p_output  OUT CLOB,
    p_success OUT NUMBER
  );

  -- Get full definition of a single questionnaire
  PROCEDURE sp_obtener_cuestionario_detalle(
    p_input   IN  CLOB,
    p_output  OUT CLOB,
    p_success OUT NUMBER
  );

  -- Save or update a questionnaire structure
  PROCEDURE sp_guardar_cuestionario(
    p_input   IN  CLOB,
    p_output  OUT CLOB,
    p_success OUT NUMBER
  );

  -- Change status (e.g. published = 1, published = 0, state/estado = 0/1)
  PROCEDURE sp_cambiar_estado_cuestionario(
    p_input   IN  CLOB,
    p_output  OUT CLOB,
    p_success OUT NUMBER
  );

  -- Duplicate a questionnaire
  PROCEDURE sp_duplicar_cuestionario(
    p_input   IN  CLOB,
    p_output  OUT CLOB,
    p_success OUT NUMBER
  );

  -- Start a questionnaire response instance
  PROCEDURE sp_iniciar_respuesta(
    p_input   IN  CLOB,
    p_output  OUT CLOB,
    p_success OUT NUMBER
  );

  -- Save responses
  PROCEDURE sp_guardar_respuestas(
    p_input   IN  CLOB,
    p_output  OUT CLOB,
    p_success OUT NUMBER
  );

  -- Finalize questionnaire response, calculate scores and classifications
  PROCEDURE sp_finalizar_cuestionario(
    p_input   IN  CLOB,
    p_output  OUT CLOB,
    p_success OUT NUMBER
  );

  -- Get detail of a questionnaire response instance
  PROCEDURE sp_obtener_respuesta_detalle(
    p_input   IN  CLOB,
    p_output  OUT CLOB,
    p_success OUT NUMBER
  );

  -- Get admin dashboard stats
  PROCEDURE sp_obtener_dashboard_stats(
    p_input   IN  CLOB,
    p_output  OUT CLOB,
    p_success OUT NUMBER
  );

END pkgln_cuestionarios;
/
