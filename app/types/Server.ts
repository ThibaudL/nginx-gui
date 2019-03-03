import Location from './Location';

type Server = {
    locations?: Location[],
    port?: number,
    name?: string,
    conf?: string,
    enable?: boolean,
    extraConf?: string
}

export default Server;