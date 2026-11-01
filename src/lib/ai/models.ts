/**
 * Modelos oficiais da xAI usados pelo app.
 *
 * Grok 4.5/4.7 gastam milhares de tokens de raciocínio numa questão curta
 * (15–45s). A sessão e a geração de pacote usam o Grok sem raciocínio, no
 * mesmo endpoint oficial. Pesquisa web vai em /v1/responses com grok-4.5.
 */
export const FAST_MODEL = "grok-4.20-0309-non-reasoning";
export const SEARCH_MODEL = "grok-4.5";
export const BLOCK_MODEL = FAST_MODEL;
