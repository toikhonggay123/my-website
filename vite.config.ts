import vinext from 'vinext';
import {defineConfig} from 'vite';
import {cloudflare} from '@cloudflare/vite-plugin';
import './scripts/tool-env.mjs';

export default defineConfig({
  plugins:[vinext(),cloudflare({
    configPath:process.env.MEALCHECK_BUILD_TARGET==='cloud-demo'?'wrangler.demo.jsonc':'wrangler.jsonc',
    viteEnvironment:{name:'rsc',childEnvironments:['ssr']},
    inspectorPort:false
  })]
});
