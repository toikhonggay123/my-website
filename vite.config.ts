import vinext from 'vinext';
import {defineConfig} from 'vite';
import {cloudflare} from '@cloudflare/vite-plugin';
import './scripts/tool-env.mjs';

export default defineConfig({
  plugins:[vinext(),cloudflare({
    viteEnvironment:{name:'rsc',childEnvironments:['ssr']},
    inspectorPort:false
  })]
});
