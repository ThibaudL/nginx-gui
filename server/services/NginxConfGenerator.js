function generateServerProps(server) {
    const p = server.props || {}
    const lines = []

    if (p.clientMaxBodySize) lines.push(`client_max_body_size ${p.clientMaxBodySize};`)
    if (p.gzip) {
        lines.push('gzip on;')
        const types = p.gzipTypes || 'text/plain text/css application/json application/javascript text/xml application/xml'
        lines.push(`gzip_types ${types};`)
    }
    if (p.accessLog === false) lines.push('access_log off;')
    if (p.ssl) {
        if (p.sslCertificate) lines.push(`ssl_certificate ${p.sslCertificate};`)
        if (p.sslCertificateKey) lines.push(`ssl_certificate_key ${p.sslCertificateKey};`)
        if (p.sslProtocols && p.sslProtocols.length) lines.push(`ssl_protocols ${p.sslProtocols.join(' ')};`)
    }

    return lines.join('\n    ')
}

function generateLocationProps(location) {
    const p = location.props || {}
    const lines = []

    if (p.websocket) {
        lines.push('proxy_http_version 1.1;')
        lines.push('proxy_set_header Upgrade $http_upgrade;')
        lines.push('proxy_set_header Connection "upgrade";')
    }
    if (p.proxyReadTimeout) lines.push(`proxy_read_timeout ${p.proxyReadTimeout};`)
    if (p.proxyConnectTimeout) lines.push(`proxy_connect_timeout ${p.proxyConnectTimeout};`)
    if (p.proxySendTimeout) lines.push(`proxy_send_timeout ${p.proxySendTimeout};`)
    if (p.proxyBuffering === 'On') lines.push('proxy_buffering on;')
    else if (p.proxyBuffering === 'Off') lines.push('proxy_buffering off;')

    if (p.cors) {
        const origin = p.corsOrigin || '*'
        lines.push(`add_header Access-Control-Allow-Origin "${origin}" always;`)
        lines.push('add_header Access-Control-Allow-Methods "GET, POST, OPTIONS, PUT, DELETE, PATCH" always;')
        lines.push('add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization" always;')
    }

    if (p.rateLimit && p.rateLimitZone) {
        let req = `limit_req zone=${p.rateLimitZone}`
        if (p.rateLimitBurst) req += ` burst=${p.rateLimitBurst} nodelay`
        lines.push(req + ';')
    }

    if (p.authBasic) {
        lines.push(`auth_basic "${p.authBasicRealm || 'Restricted'}";`)
        if (p.authBasicUserFile) lines.push(`auth_basic_user_file ${p.authBasicUserFile};`)
    }

    return lines.join('\n        ')
}

function generateLocation(location) {
    const proxyConf = location.proxyPass
        ? `proxy_pass ${location.proxyPass};\n        proxy_set_header X-Correlation-ID $correlation_id;`
        : '# No proxy_pass parametred'

    const propsConf = generateLocationProps(location)
    const extraConf = location.extraConf || '# No additionnal location configuration'

    const sections = [proxyConf]
    if (propsConf) sections.push(propsConf)
    sections.push(extraConf)

    return `
    location ${location.location || ''} {
        ${sections.join('\n        ')}
    }`;
}

function generateServer(server) {
    const propsConf = generateServerProps(server)
    const propsBlock = propsConf ? `\n    ${propsConf}\n` : ''

    return `server {
    listen          ${server.port};
    server_name     ${server.name};

    proxy_hide_header X-Server-Name;
    add_header X-Server-Name  "${server.displayName || server.name}" always;
    add_header X-Correlation-ID $correlation_id always;
    ${propsBlock}
    ${(server.extraConf || '# No additionnal server configuration')}

    ${(server.locations || []).filter(location => location.enable).map(generateLocation).join('\n')}
}`;
}

module.exports = { generateServer, generateLocation };
