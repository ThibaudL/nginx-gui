export default class EditServerCommon {
    static sample(server) {
        return `server {
    listen          ${server.port};
    server_name     ${server.name};

${(server.extraConf || '# No additionnal server configuration')}

    ${server.locations.filter(location => location.enable).map(this.sampleLocation).join('\n')}
}`;


    }

    static sampleLocation(location) {
        return `
    location ${location.location || ''} {
        ${location.proxyPass ? 'proxy_pass '+location.proxyPass+';' : '# No proxy_pass parametred'}     
        ${(location.extraConf || '# No additionnal location configuration')}
    }`;
    }

}
