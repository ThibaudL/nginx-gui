function generateLocation(location) {
    return `
    location ${location.location || ''} {
        ${location.proxyPass
            ? `proxy_pass ${location.proxyPass};\n        proxy_set_header X-Correlation-ID $correlation_id;`
            : '# No proxy_pass parametred'}
        ${(location.extraConf || '# No additionnal location configuration')}
    }`;
}

function generateServer(server) {
    return `server {
    listen          ${server.port};
    server_name     ${server.name};

    proxy_hide_header X-Server-Name;
    add_header X-Server-Name  "${server.displayName || server.name}" always;
    add_header X-Correlation-ID $correlation_id always;

    ${(server.extraConf || '# No additionnal server configuration')}

    ${(server.locations || []).filter(location => location.enable).map(generateLocation).join('\n')}
}`;
}

module.exports = { generateServer, generateLocation };
