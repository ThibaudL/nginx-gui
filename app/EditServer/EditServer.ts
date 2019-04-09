import {IComponentOptions, IController} from "angular";
import LogEntry from "../types/LogEntry";
import Server from "../types/Server";
import Location from "../types/Location";
import EditServerCommon from "../../app-common/EditServerCommon";

const template = require('./EditServer.html');

export default class EditServer implements IController {
    public static selector: string = 'editServer';
    public static component: IComponentOptions = {
        template,
        controller: EditServer,
        bindings : {
            id : '<',
            onSave : '&'
        }

    };

    private server: Server;

    public static $inject: string[] = ['$http'];
    private isRunning: boolean = false;
    private logs: LogEntry[] = [];
    private id: string;
    private onSave:Function;

    constructor(private $http) {
    }

    $onChanges() {
        this.$http.get(`/api/nginx/servers/${this.id}`)
            .then((res) => this.server = res.data);
    }

    save() {
        this.server.conf = EditServerCommon.sample(this.server);
        this.$http.post('/api/nginx/servers/'+this.id, this.server)
            .then((res) => {
                this.onSave();
            });
    }

    removeLocation(index){
        this.server.locations.splice(index,1);
    }

    deleteServer(server) {
        this.$http.delete(`/api/nginx/servers/${server.$loki}`)
            .then((res) => {
                this.onSave();
            });
    }

    sample(server){
        let s = EditServerCommon.sample(server);
        console.log(s)
        return s;
    }

}