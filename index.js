import { createProvider } from './provider.js';
export default {
  id: 'ollama-decision',
  name: 'Ollama Decision',
  register(api) { api.registerDecisionProvider(createProvider(api.pluginConfig ?? {})); },
};
