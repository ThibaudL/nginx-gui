import {IComponentOptions, IController} from "angular";
import LogEntry from "../types/LogEntry";
import Server from "../types/Server";
import Location from "../types/Location";

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
        this.server.conf = EditServer.sample(this.server);
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

    public static sample(server: Server): string {
        return `server {
    listen          ${server.port};
    server_name     ${server.name};
    
    access_log ./logs/json.log json_logs;
${(server.extraConf  || '').replace(/\n/gm,'').split(/;/gm).map(t => '    '+t).join(';\r\n')}
    
    ${server.locations.filter(location => location.enable).map(this.sampleLocation).join('\r\n')}
}`;


    }

    public static sampleLocation(location: Location): string {
        return `
    location ${location.location || ''} {
        proxy_pass ${location.proxyPass || ''};     
${(location.extraConf  || '').replace(/\n/gm,'').split(/;/gm).map(t => '    '+t).join(';\r\n')}
    }`;
    }
}