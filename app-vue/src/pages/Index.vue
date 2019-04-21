<template>
  <q-page>
    <div>
      <runner></runner>
    </div>
    <div>
      <servers></servers>
    </div>
  </q-page>
</template>

<style>
  a {
    color: var(--q-color-primary);
    font-weight: 500;
    text-decoration: none;
    outline: 0;
    border-bottom: 1px solid currentColor;
    vertical-align: center;
    transition: opacity .2s;
    white-space: nowrap;
    cursor: pointer;
  }

  tr.location {
    background-color: #2671a617;
  }

</style>


<script>

  import axios from 'axios';
  import EditServerCommon from '../../../app-common/EditServerCommon';
  import Servers from "../components/Servers";
  import Runner from "../components/Runner";

  Array.prototype.move = function (from, to) {
    this.splice(to, 0, this.splice(from, 1)[0]);
  };

  export default {
    name: 'PageIndex',
    components: {Runner, Servers},
    data: () => {
      return {
        servers: [],
        activeServer: null,
        logs: [],
        columns: [
          {},
          {name: 'displayName', align: 'left', label: 'Display name', field: 'displayName'},
          {name: 'name', align: 'left', label: 'Name', field: 'name'},
          {name: 'port', label: 'Port', field: 'port'},
          {name: 'enable', align: 'center', label: 'Enabled', field: 'enable'},
          {name: 'showConf', align: 'center', label: 'Conf'},
        ],
        showConf: false
      }
    },
    methods: {
      move(server, location, ecart) {
        const from = server.locations.findIndex((l) => l.location === location.location && l.proxyPass === location.proxyPass);
        const to = from + ecart;
        server.locations.move(from, to);
        this.editServer(server);
      },
      editServer(server, $event) {
        console.log(server, $event)
        server.conf = EditServerCommon.sample(server)
        this.save()
          .then(() => {
            this.restartIfRunnedServerHasBeenModified(server);
          });
      },
      showModalConf(server) {
        this.activeServer = server;
        this.showConf = true;
      },
      restartIfRunnedServerHasBeenModified(server) {
        // DISABLING BECAUSE IT'S UNSTABLE
        // if (server.enable) {
        //   this.isRunning().then((isRunning) => {
        //     if (isRunning) {
        //       this.restartNginx();
        //     }
        //   })
        // }
      },
      toggleServer(server) {
        if (server.enable) {
          this.servers
            .filter((s) => s.port === server.port && s.$loki !== server.$loki)
            .forEach((s) => s.enable = false);
        }
        this.save()
          .then(() => {
            this.restartIfRunnedServerHasBeenModified(server);
          });
      },
      toggleLocation(server, location) {
        if (location.enable) {
          server.locations
            .filter((l) => l.location === location.location && l.proxyPass !== location.proxyPass)
            .forEach((l) => l.enable = false);
        }
        server.conf = EditServerCommon.sample(server);
        this.save()
          .then(() => {
            // if (this.servers.some((s) => s.enable)) {
            //   this.isRunning().then((isRunning) => {
            //     if (isRunning) {
            // this.restartNginx();
            // }
            // })
            // }
          });
      },
      isRunning() {
        return axios.get(`/api/nginx/running`).then((res) => res.data);
      },
      runNginx() {
        if (!this.servers.some((server) => server.enable)) {
          this.logs.push({
            date: new Date(),
            log: 'Nothing to start, please enable at least one server'
          });
        } else {
          axios.post(`/api/nginx/run`)
            .then((res) => {
              this.logs.push(res.data);
            })
            .catch((res) => {
              this.logs.push(res.data);
            })
            .finally(() => {

            });
        }
      },
      killNginx() {
        return axios.post(`/api/nginx/kill`)
          .then((res) => {
            this.logs.push(res.data);
          })
          .catch((res) => {
            this.logs.push(res.data);
          })
          .finally(() => {

          });
      },
      restartNginx() {
        this.killNginx().then(() => this.runNginx());
      },
      save() {
        return axios.post('/api/nginx/servers', this.servers)
          .then((res) => {
            this.servers = res.data;
            return this.servers[this.servers.length - 1];
          });
      }
    },
    mounted() {
      axios.get('/api/nginx/servers')
        .then((res) => res.data)
        .then((servers) => this.servers = servers);
    }
  }
</script>
