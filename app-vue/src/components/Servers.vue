<template>
  <div>
    <div class="q-pa-md" style="width: 100%">
      <q-btn color="positive" @click="servers.push({locations : []});save()">
        <q-btn rounded outline icon="playlist_add"></q-btn>
        &nbsp;&nbsp;Add new server
      </q-btn>
      &nbsp;
      <q-btn color="primary" @click="showModalConfFile()">
        <q-btn rounded outline icon="visibility"></q-btn>
        &nbsp;&nbsp;Visualize configuration file
      </q-btn>
      &nbsp;
      <q-btn color="accent" @click="openModalAdditionnalHttpConf()">
        <q-btn rounded outline icon="edit"></q-btn>
        &nbsp;&nbsp;Edit Http additionnal configuration
      </q-btn>

    </div>
    <div class="q-pa-md" style="width: 100%">
      <q-table
        :data="servers"
        :columns="columns"
        :pagination="pagination"
        :rows-per-page-options="[0]"
        row-key="$loki"
      >
        <template slot="body" slot-scope="props">
          <q-tr class="server" :props="props">
            <q-td>
              <q-btn dense round :icon="props.expand ? 'arrow_drop_up' : 'arrow_drop_down'"
                     @click="props.expand = !props.expand">
                <q-tooltip>
                  Show {{ props.expand , locations
                </q-tooltip>
              </q-btn>
            </q-td>
            <q-td class="text-left" key="displayName" :props="props">
              <a>{{ props.row.displayName || 'SET VALUE' }}</a>
              <q-popup-edit v-model="props.row.displayName" buttons>
                <q-input v-model="props.row.displayName" @change="save" dense autofocus counter/>
              </q-popup-edit>
            </q-td>
            <q-td class="text-left" key="name" :props="props">
              <a>{{ props.row.name || 'SET VALUE' }}</a>
              <q-popup-edit v-model="props.row.name" buttons>
                <q-input v-model="props.row.name" @change="save" dense autofocus counter/>
              </q-popup-edit>
            </q-td>
            <q-td key="port" :props="props">
              <a>{{ props.row.port || 'SET VALUE' }}</a>
              <q-popup-edit v-model="props.row.port" buttons>
                <q-input v-model="props.row.port" @change="save" dense autofocus counter/>
              </q-popup-edit>
            </q-td>
            <q-td key="enable" class="text-center">
              <q-toggle dense v-model="props.row.enable" @input="toggleServer(props.row)"/>
            </q-td>
            <q-td key="additionnalConf" class="text-center">
              <q-btn outline round color="accent" icon="edit" @click="showModalAdditionnalConf(props.row)"/>
            </q-td>
            <q-td key="showConf" class="text-center">
              <q-btn outline round color="primary" icon="visibility" @click="showModalConf(props.row)"/>
            </q-td>
            <q-td>
              <q-btn outline round color="negative" icon="delete_sweep"
                     @click="removeServer(props.key, props.row)">
                <q-tooltip>Remove Server</q-tooltip>
              </q-btn>
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
              Additionnal Configuration
            </q-th>
            <q-th>
              <q-btn outline round color="positive" icon="playlist_add"
                     @click="props.row.locations.push({location : 'FILL LOCATION',proxyPass:'FILL PROXY-PASS',enable : false});editServer(props.row)">
                <q-tooltip>Add new Location</q-tooltip>
              </q-btn>
            </q-th>
          </q-tr>
          <q-tr class="location" v-if="props.expand" :props="props"
                v-for="(aLocation,idLocation) in props.row.locations"
                :key="aLocation.$loki">
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
                <a>{{ aLocation.location }}</a>
                <q-popup-edit v-model="aLocation.location" buttons persistent>
                  <q-input v-model="aLocation.location" @change="editServer(props.row)" dense autofocus counter/>
                </q-popup-edit>
              </div>
            </q-td>
            <q-td colspan="2">
              <div class="text-left">
                <a>{{ aLocation.proxyPass }}</a>
                <q-popup-edit v-model="aLocation.proxyPass">
                  <q-input v-model="aLocation.proxyPass" @change="editServer(props.row)" dense autofocus counter/>
                </q-popup-edit>
              </div>
            </q-td>
            <q-td>
              <q-toggle dense v-model="aLocation.enable" @input="toggleLocation(props.row,aLocation)"/>
            </q-td>
            <q-td>
              <q-btn outline round color="accent" icon="edit" @click="showModalAdditionnalConf(props.row,aLocation)"/>
            </q-td>
            <q-td>
              <q-btn outline round color="negative" icon="delete_sweep"
                     @click="removeLocation(props,idLocation, aLocation)">
                <q-tooltip>Remove Location</q-tooltip>
              </q-btn>
            </q-td>
          </q-tr>
        </template>
      </q-table>
    </div>
    <q-dialog @hide="cleanModalContext()" v-model="showConf" v-if="activeServer || confFile">
      <q-card>
        <q-card-section>
          <div class="text-h6">{{ (activeServer && activeServer.displayName) || 'Configuration File' }}</div>
        </q-card-section>
        <q-card-section>
              <pre>
  {{ (activeServer && activeServer.conf) || confFile }}
              </pre>
        </q-card-section>
      </q-card>
    </q-dialog>
    <q-dialog v-model="showAdditionnalConf" @hide="cancelAdditionnalConf()" >
      <q-card v-if="showAdditionnalConf" class="additionnal-conf">
        <q-card-section>
          <div class="text-h6">Additionnal Configuration</div>
        </q-card-section>
        <q-card-section>
          <q-input v-model="tmpAdditionnalConf"
                   @change="save"
                   type="textarea"
                   dense autofocus counter filled/>
        </q-card-section>
        <!--        <q-separator inset />-->
        <q-card-actions align="right">
          <q-btn @click="cancelAdditionnalConf()">Cancel</q-btn>
          <q-btn class="bg-primary text-white" @click="applyAdditionnalConf()">Apply</q-btn>
        </q-card-actions>
      </q-card>
    </q-dialog>
    <q-dialog v-model="showAdditionnalHttpConf" @hide="cancelAdditionnalHttpConf()">
      <q-card v-if="showAdditionnalHttpConf" class="additionnal-conf">
        <q-card-section>
          <div class="text-h6">Additionnal Http Configuration</div>
        </q-card-section>
        <q-card-section>
          <q-input v-model="tmpAdditionnalHttpConf"
                   type="textarea"
                   dense autofocus counter filled/>
        </q-card-section>
        <!--        <q-separator inset />-->
        <q-card-actions align="right">
          <q-btn @click="cancelAdditionnalHttpConf()">Cancel</q-btn>
          <q-btn class="bg-primary text-white" @click="applyAdditionnalHttpConf()">Apply</q-btn>
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<style>
.additionnal-conf {
  width: 40%;
}

/*.additionnal-conf q-card-actions>button {*/
/*  margin: 20px;*/
/*  margin: 20px;*/
/*}*/

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

Array.prototype.move = function (from, to) {
  this.splice(to, 0, this.splice(from, 1)[0]);
};

export default {
  name: 'Servers',
  data: () => {
    return {
      servers: [],
      httpConf: {},
      activeServer: null,
      activeLocation: null,
      logs: [],
      columns: [
        {},
        {name: 'displayName', align: 'left', label: 'Display name', field: 'displayName'},
        {name: 'name', align: 'left', label: 'Name', field: 'name'},
        {name: 'port', label: 'Port', field: 'port'},
        {name: 'enable', align: 'center', label: 'Enabled', field: 'enable'},
        {name: 'additionnalConf', align: 'center', label: 'Additionnal Configuration'},
        {name: 'showConf', align: 'center', label: 'Conf'},
        {}
      ],
      showConf: false,
      confFile: null,
      showAdditionnalConf: false,
      showAdditionnalHttpConf: false,
      tmpAdditionnalConf: '',
      tmpAdditionnalHttpConf: '',
      pagination: {'rowsPerPage': 0}
    }
  },
  methods: {
    removeServer(key, server) {
      if (key) {
        this.$q.dialog({
          title: 'Confirm',
          message: 'Are you sure you want to delete the server "' + server.displayName + '"',
          ok: {
            push: true,
            label: 'Yes'
          },
          cancel: {
            push: true,
            color: 'negative',
            label: 'No'
          },
          persistent: true
        }).onOk(() => {
          axios.delete('/api/nginx/servers/' + key)
            .then((res) => this.getServers());
        })
      }
    },
    removeLocation(props, idLocation, aLocation) {
      this.$q.dialog({
        title: 'Confirm',
        message: 'Are you sure you want to delete the location "' + aLocation.location + '" with proxy pass "' + aLocation.proxyPass + '"',
        ok: {
          push: true,
          label: 'Yes'
        },
        cancel: {
          push: true,
          color: 'negative',
          label: 'No'
        },
        persistent: true
      }).onOk(() => {
        props.row.locations.splice(idLocation, 1);
        this.editServer(props.row);
      })
    },
    move(server, location, ecart) {
      const from = server.locations.findIndex((l) => l.location === location.location && l.proxyPass === location.proxyPass);
      const to = from + ecart;
      server.locations.move(from, to);
      this.editServer(server);
    },
    editServer(server, $event) {
      server.conf = EditServerCommon.sample(server)
      this.save()
        .then(() => {
          this.restartIfRunnedServerHasBeenModified(server);
        });
    },
    cleanModalContext() {
      this.activeServer = null;
      this.confFile = null;
    },
    showModalConf(server) {
      this.activeServer = server;
      this.showConf = true;
    },
    showModalConfFile() {
      this.getConfFile().then(confFile => {
        this.confFile = confFile;
        this.showConf = true;
      });
    },
    showModalAdditionnalConf(server, location) {
      this.activeServer = server;
      if (location) {
        this.activeLocation = location;
        this.tmpAdditionnalConf = this.activeLocation.extraConf;
      } else {
        this.tmpAdditionnalConf = this.activeServer.extraConf;
      }
      this.showAdditionnalConf = true;
    },
    cancelAdditionnalConf() {
      this.showAdditionnalConf = false;
      this.activeServer = null;
      this.activeLocation = null;
      this.tmpAdditionnalConf = '';
    },
    openModalAdditionnalHttpConf(){
      this.showAdditionnalHttpConf = true;
      this.tmpAdditionnalHttpConf = this.httpConf.additionnalHttpConf;
    },
    cancelAdditionnalHttpConf() {
      this.showAdditionnalHttpConf = false;
      this.tmpAdditionnalHttpConf = '';
    },
    applyAdditionnalHttpConf() {
      this.showAdditionnalHttpConf = false;
      this.httpConf.additionnalHttpConf = this.tmpAdditionnalHttpConf;
      axios.post('/api/nginx/http', this.httpConf);
    },
    applyAdditionnalConf() {
      this.showAdditionnalConf = false;
      let foundServer = this.servers
        .find((s) => s.port === this.activeServer.port && s.$loki === this.activeServer.$loki);
      if (this.activeLocation) {
        foundServer.locations.find((aLocation) => aLocation.location === this.activeLocation.location && aLocation.proxyPass === this.activeLocation.proxyPass)
          .extraConf = this.tmpAdditionnalConf;
      } else {
        foundServer.extraConf = this.tmpAdditionnalConf;
      }
      foundServer.conf = EditServerCommon.sample(foundServer);
      this.save();
      this.activeServer = null;
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
      console.log(server.enable);
      if (server.enable) {
        let serversToDisable = this.servers
          .filter((s) => s.port === server.port && s.$loki !== server.$loki);
        console.log(this.servers.map((s) => ({loki: s.$loki, enable: s.enable})));
        serversToDisable
          .forEach((s) => s.enable = false);
        console.log(this.servers.map((s) => ({loki: s.$loki, enable: s.enable})));
      }
      this.save();
    },
    toggleLocation(server, location) {
      if (location.enable) {
        server.locations
          .filter((l) => l.location === location.location && l.proxyPass !== location.proxyPass)
          .forEach((l) => l.enable = false);
      }
      server.conf = EditServerCommon.sample(server);
      this.save();
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
    },
    getServers() {
      axios.get('/api/nginx/servers')
        .then((res) => res.data)
        .then((servers) => this.servers = servers);
    },
    getHttpConf() {
      axios.get('/api/nginx/http')
        .then((res) => res.data)
        .then((httpConf) => this.httpConf = httpConf && httpConf.length > 0 ? httpConf[0] : {});
    }
    ,
    getConfFile() {
      return axios.get('/api/nginx/conf')
        .then((res) => res.data);
    }
  },
  mounted() {
    this.getServers();
    this.getHttpConf();
  }
}
</script>
