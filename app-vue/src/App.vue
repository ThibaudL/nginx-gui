<template>
  <div id="app">
    <header class="app-header">
      <span class="app-title">Nginx GUI</span>
    </header>
    <main class="app-body">
      <aside class="runner-panel">
        <Runner />
      </aside>
      <section class="servers-panel">
        <Servers />
      </section>
    </main>
    <ConfirmDialog />
  </div>
</template>

<script setup>
import ConfirmDialog from 'primevue/confirmdialog'
import Runner from './components/Runner.vue'
import Servers from './components/Servers.vue'
</script>

<style>
*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; font-family: var(--p-font-family, sans-serif); background: var(--p-surface-ground, #f8f9fa); }

.app-header {
  background: var(--p-primary-color, #6366f1);
  color: #fff;
  padding: 0.75rem 1.5rem;
  font-size: 1.2rem;
  font-weight: 600;
}

.app-body {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  min-height: calc(100vh - 50px);
}

.runner-panel {
  width: 280px;
  flex-shrink: 0;
}

.servers-panel {
  flex: 1;
  min-width: 0;
}
</style>
