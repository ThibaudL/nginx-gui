<template>
  <div class="q-pa-md" style="width: 100%">
    <q-card>
      <q-card-section>
        <q-btn color="green" class="full-width" v-if="!isRunning" @click="runNginx">Run Nginx</q-btn>
        <q-btn color="red" class="full-width" v-if="isRunning" @click="killNginx">Kill Nginx</q-btn>
        <q-btn color="secondary" class="full-width">Show Access log</q-btn>
      </q-card-section>
    </q-card>
    <q-card>
      <q-card-section>
        Nginx logs :
      </q-card-section>
      <q-separator inset />
      <q-card-section>
          <pre v-for="logEntry in logs">{{logEntry.log}}</pre>
      </q-card-section>
    </q-card>
  </div>
</template>

<script>
  import axios from 'axios';

  export default {
    name: 'Runner',
    data: () => ({
      logs : [],
      isRunning : false
    }),
    methods : {
      initIsRunning() {
        return axios.get(`/api/nginx/running`)
          .then((res) => res.data)
          .then((isRunning) => this.isRunning = isRunning);
      },
      runNginx() {
        this.isRunning = true;
        axios.post(`/api/nginx/run`)
          .then((res) => {
            this.logs.push(res.data);
          })
          .catch((res) => {
            this.logs.push(res.data);
          })
          .finally(() => {
            this.initIsRunning();
          });
      },
      killNginx() {
        this.isRunning = false;
        return axios.post(`/api/nginx/kill`)
          .then((res) => {
            this.logs.push(res.data);
          })
          .catch((res) => {
            this.logs.push(res.data);
          })
          .finally(() => {
            this.initIsRunning();
          });
      }
    },
    mounted(){
      this.initIsRunning();
    }
  }
</script>
