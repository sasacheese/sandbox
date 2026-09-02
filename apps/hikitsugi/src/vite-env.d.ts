/// <reference types="vite/client" />

/**
 * ビルド時に束ねる値。GitHub Actions が repo secret / variable から渡す。
 *
 * 配信物に入るので、公開サイトから読める。上限つきの鍵を使うこと。
 */
interface ImportMetaEnv {
  readonly VITE_OPENAI_API_KEY?: string;
  readonly VITE_OPENAI_MODEL?: string;
}
