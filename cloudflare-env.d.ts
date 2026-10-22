declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    ADMIN_SETUP_TOKEN?: string;
    RESEND_API_KEY?: string;
    EMAIL_FROM?: string;
    EMAIL_AUTH_SECRET?: string;
    DEEPSEEK_API_KEY?: string;
  }
}
