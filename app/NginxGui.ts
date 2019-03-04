import {IComponentOptions, IController} from "angular";

const template = require('./NginxGui.html');
import './NginxGui.css';
import LogEntry from "./types/LogEntry";
import Server from "./types/Server";
import Location from "./types/Location";
import ConfModal from "./ConfModal/ConfModal";
import AccessLogModal from "./AccessLogModal/AccessLogModal";
import EditServer from "./EditServer/EditServer";


export default class NginxGui implements IController {
    public static selector: string = 'nginxGui';
    public static component: IComponentOptions = {
        template,
        controller: NginxGui
    };

    private servers: Server[] = [];

    private isRunning: boolean = false;
    private logs: LogEntry[] = [];
    private mode: 'nominal' | 'edit' = 'nominal';
    private editServer: Server;

    public static $inject: string[] = ['$http', '$uibModal'];
    constructor(private $http, private $uibModal) {
    }

    $onInit() {
        this.$http.get('/api/nginx/servers')
            .then((res) => this.servers = res.data);
        this.initIsRunning();
    }

    edit(server){
        this.mode = 'edit';
        this.editServer = server;
    }

    openConf(server){
        ConfModal.openModal(this.$uibModal, server);
    }

    showAccessLog(){
        AccessLogModal.openModal(this.$uibModal);
    }

    stopEdit(){
        this.mode = 'nominal';
        this.editServer = null;
        this.$http.get('/api/nginx/servers')
            .then((res) => this.servers = res.data);
    }

    addServer(){
        this.servers.push({locations:[{}]});
        this.save()
            .then((lastServer) => {
                this.editServer = lastServer;
                this.mode = "edit";
            });
        window.setTimeout(() => {
            (window as any).$('.toogle').bootstrapToggle();
        },0)
    }

    changedLocation(server){
        server.conf = EditServer.sample(server);
        this.save();
    }

    save() {
        return this.$http.post('/api/nginx/servers', this.servers)
            .then((res) => {
                this.servers = res.data;
                return this.servers[this.servers.length-1];
            });
    }


    runNginx(): void {
        if (!this.servers.some((server) => server.enable)) {
            this.logs.push({
                date: new Date(),
                log: 'Nothing to start, please enable at least one server'
            });
        } else {
            this.$http.post(`/api/nginx/run`)
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
    }

    killNginx(): void {
        this.$http.post(`/api/nginx/kill`)
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

    initIsRunning(): void {
        this.$http.get(`/api/nginx/running`).then((res) => this.isRunning = res.data);
    }
}