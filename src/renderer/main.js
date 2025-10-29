import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import '../styles/app.scss';

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.mount('#app');

// Global error handler
app.config.errorHandler = (err, instance, info) => {
  console.error('Global error:', err);
  console.error('Component:', instance);
  console.error('Error info:', info);
  
  // TODO: Show error dialog to user
};
