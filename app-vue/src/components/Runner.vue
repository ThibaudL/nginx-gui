<template>
  <div class="q-pa-md runner" style="width: 100%">
    <q-card>
      <q-card-section>
        <q-btn color="green" class="full-width" v-if="!isRunning" @click="runNginx">Run Nginx</q-btn>
        <q-btn color="red" class="full-width" v-if="isRunning" @click="killNginx">Kill Nginx</q-btn>
        <q-btn color="secondary" class="full-width" @click="showLog">Show Access log</q-btn>
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
    <q-dialog v-model="openedLog" >
      <q-card>
        <q-card-section>
          <div class="text-h6">Access Logs</div>
        </q-card-section>
        <q-card-section>
          <q-table
            :data="accessLogs"
            :columns="columns"
            :pagination="{'rowsPerPage':0}"
            :rows-per-page-options="[0]"
            :filter="filter"
            row-key="id"
          >
            <template v-slot:top-left>
              <q-input  dense debounce="300" v-model="filter" label="Filter results">
                <template v-slot:append>
                  <q-icon name="search" />
                </template>
              </q-input>
            </template>
          </q-table>
        </q-card-section>
      </q-card>
    </q-dialog>
  </div>
</template>
<style>
  .q-dialog.fullscreen .q-dialog__inner--minimized > div {
  max-width: 80%;
}
</style>
<script>
  import axios from 'axios';

  export default {
    name: 'Runner',
    data: () => ({
      filter : '',
      logs : [],
      accessLogs : [],
      columns : [
        {name: 'remote_addr', align:'left', label: 'Remote ADDR', field: 'remote_addr'},
        {name: 'remote_user', align:'left', label: 'Remote User', field: 'remote_user'},
        {name: 'time_local', align:'left', label: 'Time', field: 'time_local'},
        {name: 'proxy_host', align:'left', label: 'Proxy host', field: 'proxy_host'},
        {name: 'request', align:'left', label: 'Request', field : 'request'},
        {name: 'status', align:'left', label: 'Status', field : 'status'},
        {name: 'body_bytes_sent', align:'left', label: 'Bytes sent', field : 'body_bytes_sent'},
        {name: 'http_referrer', align:'left', label: 'Referer', field : 'http_referrer'},
        {name: 'http_user_agent', align:'left', label: 'User agent', field : 'http_user_agent'},
      ],
      isRunning : false,
      openedLog : false
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
      },
      getAccessLog(){
        let id = 0;
        return axios.get('/api/nginx/logs/access')
          .then((res) => this.logs = res.data.map((access) => {
            try {
              return JSON.parse(access);
            } catch {
              return {};
            }
          }))
          .then((logs) => this.accessLogs = logs.map((log) => ({...log,id:id++})));
      },
      showLog(){
        this.getAccessLog().then(() => {
          this.openedLog = true;
        })
      }
    },
    mounted(){
      this.initIsRunning();
    }
  }
</script>
