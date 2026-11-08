declare namespace Cloudflare {
  interface Env {
    AFYLLX_WEB?: Fetcher;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}


declare namespace Cloudflare {interface Env {MEALCHECK_QR_KEY?:string; MEALCHECK_QA_MODE?:string; MEALCHECK_DEPLOYMENT?:string; MEALCHECK_PUBLIC_HOST?:string; MEALCHECK_PUBLIC_HOST_ALIASES?:string;}}
declare namespace Cloudflare {interface Env {RL_PAGE?:RateLimit; RL_READ?:RateLimit; RL_WRITE?:RateLimit; RL_HEAVY?:RateLimit; RL_ENROLL?:RateLimit; RL_ENROLL_GLOBAL?:RateLimit; RL_DIRECTORY?:RateLimit;}}
