import Server from "../types/Server";

const template = require('./ConfModal.html');

export default class ConfModal {

    public static openModal = ($uibModal, server) => {
        return $uibModal.open({
            template,
            controller : ConfModal,
            controllerAs : '$ctrl',
            resolve : {
                server : () => server
            }
        });
    }

    public static $inject:string[] = ['server', '$uibModalInstance'];
    constructor(private server:Server, private $uibModalInstance){

    }

    close(){
        this.$uibModalInstance.close();
    }

}