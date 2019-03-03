import Server from "../types/Server";

const template = require('./AccessLogModal.html');

export default class AccessLogModal {

    public static openModal = ($uibModal) => {
        return $uibModal.open({
            template,
            controller : AccessLogModal,
            controllerAs : '$ctrl',
            size:'xl'
        });
    };

    public static $inject:string[] = ['$uibModalInstance', '$http'];
    private logs: string[];
    private filter: string = '';
    constructor(private $uibModalInstance, private $http){

    }

    $onInit(){
        this.$http.get('/api/nginx/logs/access')
            .then((res) => this.logs = res.data)
    }

    close(){
        this.$uibModalInstance.close();
    }

}