//Thanks to Christophe Genin : https://github.com/cgenin/tomcat-deploy-web/blob/master/server/deploydb.js
const LOGGER = require('./utils/logger');
const path = require('path');
const fs = require('fs');
const homedir = require('os').homedir();

const DeployDB = function DeployDB() {

    //Collections
    const nginxCollection = 'nginx';
    const nginxHttpConf = 'nginxHttpConf';

    const loki = require('lokijs');
    let dbPath = path.join(homedir, 'nginx-gui');

    if(!fs.existsSync(dbPath)) {
        LOGGER.debug('Creating data folder : '+dbPath);
        fs.mkdirSync(dbPath);
    }

    if(!fs.existsSync(dbPath+'/data.json')){
        LOGGER.debug('Copying init database because none where found.');
        const dbInitPath = path.join(__dirname, 'db/data.init.json');
        fs.createReadStream(dbInitPath).pipe(fs.createWriteStream(dbPath+'/data.json'));
    }

    const db = new loki(dbPath+'/data.json');
    LOGGER.debug(`DB path : ${dbPath+'/data.json'}`);
    const createIfNotExist = function (name) {
        LOGGER.debug(`DB : createIfNotExist : ${name}`);
        if (!db.getCollection(name)) {
            db.addCollection(name);
            db.saveDatabase();
        }
    };

    this.init = function () {
        return new Promise((success) => {
            db.loadDatabase({}, () => {
                createIfNotExist(nginxCollection);
                createIfNotExist(nginxHttpConf);
                success(db);
            });
        });
    };

    this.getNginx = function () {
        return db.getCollection(nginxCollection);
    };

    this.getNginxHttpConf = function () {
        return db.getCollection(nginxHttpConf);
    };

    this.insert = function (collection, item) {
        collection.insert(item);
        db.saveDatabase();
    };

    this.save = function (collection, item) {
        if (item.$loki) {
            collection.update(item);
        } else {
            collection.insert(item);
        }
        db.saveDatabase();
    };

    this.updateStatus = function (collection, item, state, host) {
        if (item.$loki) {
            const filter = collection.data.filter((i) => i.$loki === item.$loki);
            if (filter && filter.length > 0) {
                const selected = filter[0];
                selected.deployStates = selected.deployStates || {};
                selected.deployStates[host] = {
                    state, dt: new Date()
                };
                collection.update(selected);
                db.saveDatabase();
                return selected;
            }
        }
        return item;
    };

    this.remove = function (collection, item) {
        collection.remove(item);
        db.saveDatabase();
    };
    this.close = function () {
        db.close();
    };
    if (DeployDB.caller !== DeployDB.getInstance) {
        throw new Error('This object cannot be instanciated');
    }
};

/* ************************************************************************
 SINGLETON CLASS DEFINITION
 ************************************************************************ */
DeployDB.instance = null;

/**
 * Singleton getInstance definition
 * @return DeployDB class
 */
DeployDB.getInstance = function () {
    if (this.instance === null) {
        this.instance = new DeployDB();
    }
    return this.instance;
};

module.exports = DeployDB.getInstance();
