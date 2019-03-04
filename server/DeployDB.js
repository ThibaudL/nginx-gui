//Thanks to Christophe Genin : https://github.com/cgenin/tomcat-deploy-web/blob/master/server/deploydb.js
const LOGGER = require('./utils/logger');
const path = require('path');
const fs = require('fs');

const DeployDB = function DeployDB() {

    //Collections
    const nginxCollection = 'nginx';

    const loki = require('lokijs');
    let dbPath = path.join(__dirname, 'db/data.json');

    if(!fs.existsSync(dbPath)){
        LOGGER.debug('Copying init database because none where found.');
        const dbInitPath = path.join(__dirname, 'db/data.init.json');
        fs.createReadStream(dbPath).pipe(fs.createWriteStream(dbPath));
    }

    const db = new loki(dbPath);
    LOGGER.debug(`DB path : ${dbPath}`);
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
                success(db);
            });
        });
    };

    this.getNginx = function () {
        return db.getCollection(nginxCollection);
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
