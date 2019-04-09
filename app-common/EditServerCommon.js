export default class EditServerCommon {
    static sample(server) {
        return `server {
    listen          ${server.port};
    server_name     ${server.name};
    
    access_log ./logs/json.log json_logs;
${(server.extraConf || '').replace(/\n/gm, '').split(/;/gm).map(t => '    ' + t).join(';\r\n')}
    
    ${server.locations.filter(location => location.enable).map(this.sampleLocation).join('\r\n')}
}`;


    }

    static sampleLocation(location) {
        return `
    location ${location.location || ''} {
        proxy_pass ${location.proxyPass || ''};     
${(location.extraConf || '').replace(/\n/gm, '').split(/;/gm).map(t => '    ' + t).join(';\r\n')}
    }`;
    }

}