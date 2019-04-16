<template>
  <q-page class="flex ">
    <div class="q-pa-md" style="width: 100%">
      <q-table
        :data="servers"
        :columns="columns"
        :rows-per-page-options="[]"
        row-key="$loki"
      >
        <template slot="body" slot-scope="props">
          <q-tr class="server" :props="props">
            <q-td>
              <q-btn dense round :icon="props.expand ? 'arrow_drop_up' : 'arrow_drop_down'"
                     @click="props.expand = !props.expand">
                <q-tooltip>
                  Show {{props.expand ,locations
                </q-tooltip>
              </q-btn>
            </q-td>
            <q-td class="text-left" key="displayName" :props="props">
              <a>{{ props.row.displayName || 'SET VALUE'}}</a>
              <q-popup-edit v-model="props.row.displayName" buttons>
                <q-input v-model="props.row.displayName" @change="save" dense autofocus counter/>
              </q-popup-edit>
            </q-td>
            <q-td class="text-left" key="name" :props="props">
              <a>{{ props.row.name || 'SET VALUE'}}</a>
              <q-popup-edit v-model="props.row.name" buttons>
                <q-input v-model="props.row.name" @change="save" dense autofocus counter/>
              </q-popup-edit>
            </q-td>
            <q-td key="port" :props="props">
              <a>{{ props.row.port || 'SET VALUE'}}</a>
              <q-popup-edit v-model="props.row.port" buttons>
                <q-input v-model="props.row.port" @change="save" dense autofocus counter/>
              </q-popup-edit>
            </q-td>
            <q-td key="enable" class="text-center">
              <q-toggle dense v-model="props.row.enable" @input="toggleServer(props.row)"/>
            </q-td>
            <q-td key="showConf" class="text-center">
              <q-btn outline round color="primary" icon="visibility" @click="showModalConf(props.row)"/>
            </q-td>
          </q-tr>
          <q-tr class="location" v-if="props.expand" :props="props">
            <q-td class="text-center">Order</q-td>
            <q-th colspan="2" class="text-left">Location</q-th>
            <q-th colspan="2">Proxy pass</q-th>
            <q-th>
              Enabled
            </q-th>
            <q-th>
              <q-btn outline round color="primary" icon="playlist_add" @click="props.row.locations.push({location : 'FILL LOCATION',proxyPass:'FILL PORXY-PASS',enable : false});editServer(props.row)">
                <q-tooltip>Add a new Location</q-tooltip>
              </q-btn>
            </q-th>
          </q-tr>
          <q-tr class="location" v-if="props.expand" :props="props" v-for="(aLocation,idLocation) in props.row.locations"
                :key="aLocation.location">
            <q-td class="text-center">
              <q-btn-group dense flat rounded>

                <q-btn rounded icon="arrow_drop_up" v-if="idLocation>0"
                       @click="move(props.row,aLocation,-1)">
                </q-btn>
                <q-btn rounded icon="arrow_drop_down" v-if="idLocation<props.row.locations.length-1"
                       @click="move(props.row,aLocation,1)">
                </q-btn>
              </q-btn-group>
            </q-td>
            <q-td colspan="2">
              <div class="text-left">
                <a>{{aLocation.location}}</a>
                <q-popup-edit v-model="aLocation.location">
                  <q-input v-model="aLocation.location" @change="editServer(props.row)" dense autofocus counter/>
                </q-popup-edit>
              </div>
            </q-td>
            <q-td colspan="2">
              <div class="text-left">
                <a>{{aLocation.proxyPass}}</a>
                <q-popup-edit v-model="aLocation.proxyPass">
                  <q-input v-model="aLocation.proxyPass" @change="editServer(props.row)" dense autofocus counter/>
                </q-popup-edit>
              </div>
            </q-td>
            <q-td>
              <q-toggle dense v-model="aLocation.enable" @input="toggleLocation(props.row,aLocation)"/>
            </q-td>
            <q-td>
              <q-btn outline round color="primary" icon="delete_sweep" @click="props.row.locations.splice(idLocation,1);editServer(props.row)">
                <q-tooltip>Remove Location</q-tooltip>
              </q-btn>
            </q-td>
          </q-tr>
        </template>
      </q-table>
    </div>
    <q-dialog v-model="showConf" v-if="activeServer">
      <q-card>
        <q-card-section>
          <div class="text-h6">{{activeServer.displayName}}</div>
        </q-card-section>
        <q-card-section>
            <pre>
{{activeServer.conf}}
            </pre>
        </q-card-section>
      </q-card>
    </q-dialog>
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

  Array.prototype.move = function(from, to) {
    this.splice(to, 0, this.splice(from, 1)[0]);
  };

  export default {
    name: 'PageIndex',
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
      move(server,location,ecart){
        const from = server.locations.findIndex((l) => l.location === location.location && l.proxyPass === location.proxyPass);
        const to = from + ecart;
        server.locations.move(from,to);
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
      toggleLocation(server,location) {
        if(location.enable){
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
