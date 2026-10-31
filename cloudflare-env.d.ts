declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}


declare namespace Cloudflare {interface Env {MEALCHECK_QR_KEY?:string; MEALCHECK_QA_MODE?:string; MEALCHECK_DEPLOYMENT?:string; MEALCHECK_PUBLIC_HOST?:string;}}
